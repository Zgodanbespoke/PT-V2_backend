import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertStockSchema, stockPriceSchema } from "@shared/schema";
import { z } from "zod";
import { AngelOneAPI, STOCK_TOKENS } from "./angelone-api";
import { YahooFinanceAPI } from "./yahoo-finance-api";

export async function registerRoutes(app: Express): Promise<Server> {
  const ANGELONE_API_KEY = process.env.ANGELONE_API_KEY || "";
  const ANGELONE_CLIENT_ID = process.env.ANGELONE_CLIENT_ID || "";
  const ANGELONE_API_SECRET = process.env.ANGELONE_API_SECRET || "";
  const ANGELONE_REDIRECT_URL = process.env.ANGELONE_REDIRECT_URL || "";

  // Initialize Angel One API
  const angelOneAPI = new AngelOneAPI({
    apiKey: ANGELONE_API_KEY,
    clientId: ANGELONE_CLIENT_ID,
    apiSecret: ANGELONE_API_SECRET,
    redirectUrl: ANGELONE_REDIRECT_URL
  });

  // Initialize Yahoo Finance API
  const yahooAPI = new YahooFinanceAPI();

  // Real market data integration with Yahoo Finance
  async function fetchStockPrice(symbol: string, exchange: string) {
    try {
      // Get live data from Yahoo Finance API
      const quote = await yahooAPI.getQuote(symbol, exchange);
      
      return {
        symbol,
        exchange,
        currentPrice: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        dayHigh: quote.regularMarketDayHigh,
        dayLow: quote.regularMarketDayLow,
        dayOpen: quote.regularMarketOpen,
        previousClose: quote.regularMarketPreviousClose,
        volume: quote.regularMarketVolume
      };
    } catch (error: any) {
      console.error(`Yahoo Finance API error for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch live price for ${symbol}: ${error.message}`);
    }
  }

  // Angel One authentication endpoint
  app.post("/api/auth/angelone/login", async (req, res) => {
    try {
      const { clientCode, password, totp } = req.body;
      
      if (!clientCode || !password || !totp) {
        return res.status(400).json({ error: "Client code, password, and TOTP are required" });
      }

      const tokens = await angelOneAPI.login(clientCode, password, totp);
      res.json({ 
        success: true, 
        message: "Authentication successful",
        authenticated: true
      });
    } catch (error: any) {
      res.status(401).json({ 
        error: "Authentication failed", 
        message: error.message,
        authenticated: false
      });
    }
  });

  // Check authentication status
  app.get("/api/auth/angelone/status", async (req, res) => {
    res.json({ 
      authenticated: angelOneAPI.isAuthenticated(),
      hasCredentials: !!(ANGELONE_API_KEY && ANGELONE_CLIENT_ID)
    });
  });

  // Get all stocks
  app.get("/api/stocks", async (req, res) => {
    try {
      const stocks = await storage.getAllStocks();
      res.json(stocks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stocks" });
    }
  });

  // Search stocks
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      // Use Yahoo Finance search for live stock data
      try {
        const yahooResults = await yahooAPI.searchSymbols(q);
        if (yahooResults && yahooResults.length > 0) {
          // Convert Yahoo Finance results to our stock format
          const formattedResults = yahooResults.slice(0, 10).map(stock => {
            const { symbol: baseSymbol, exchange } = yahooAPI.extractBaseSymbol(stock.symbol);
            return {
              id: Math.abs(baseSymbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0)),
              symbol: baseSymbol,
              exchange: exchange,
              name: stock.longname || stock.shortname || baseSymbol,
              currentPrice: "0.00",
              previousClose: "0.00", 
              dayHigh: "0.00",
              dayLow: "0.00",
              dayOpen: "0.00",
              volume: 0,
              lastUpdated: new Date()
            };
          });
          
          return res.json(formattedResults);
        }
      } catch (apiError) {
        console.error("Yahoo Finance search error:", apiError);
      }

      // Fallback to local database search
      const stocks = await storage.searchStocks(q);
      res.json(stocks);
    } catch (error) {
      res.status(500).json({ error: "Failed to search stocks" });
    }
  });

  // Get real-time stock price
  app.get("/api/stocks/:symbol/:exchange/price", async (req, res) => {
    try {
      const { symbol, exchange } = req.params;
      const priceData = await fetchStockPrice(symbol, exchange);
      
      // Update stock in storage
      await storage.updateStockPrice(symbol, exchange, priceData.currentPrice);
      
      res.json(priceData);
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch stock price: ${error}` });
    }
  });

  // Place order
  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const userId = 1; // Demo user ID

      // Validate stock exists
      const stock = await storage.getStock(orderData.symbol, orderData.exchange);
      if (!stock) {
        return res.status(400).json({ error: "Stock not found" });
      }

      // Create order
      const order = await storage.createOrder({ ...orderData, userId });

      // Check if order should be executed immediately (market order or limit price met)
      const currentPrice = parseFloat(stock.currentPrice);
      const limitPrice = parseFloat(orderData.limitPrice);
      
      let shouldExecute = false;
      if (orderData.orderType === "BUY" && currentPrice <= limitPrice) {
        shouldExecute = true;
      } else if (orderData.orderType === "SELL" && currentPrice >= limitPrice) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        await executeOrder(order.id, currentPrice);
      }

      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to place order" });
    }
  });

  // Execute order function
  async function executeOrder(orderId: number, executionPrice: number) {
    try {
      const order = await storage.getOrder(orderId);
      if (!order || order.status !== "PENDING") return;

      // Update order status
      await storage.updateOrderStatus(orderId, "EXECUTED", executionPrice);

      // Create trade record
      const totalValue = order.quantity * executionPrice;
      await storage.createTrade({
        orderId: order.id,
        symbol: order.symbol,
        exchange: order.exchange,
        tradeType: order.orderType,
        quantity: order.quantity,
        price: executionPrice.toFixed(2),
        totalValue: totalValue.toFixed(2),
        userId: order.userId
      });

      // Update position
      const existingPosition = await storage.getPosition(order.userId, order.symbol, order.exchange);
      
      if (order.orderType === "BUY") {
        if (existingPosition) {
          // Update existing position
          const newQuantity = existingPosition.quantity + order.quantity;
          const newAveragePrice = (
            (existingPosition.quantity * parseFloat(existingPosition.averagePrice)) + 
            (order.quantity * executionPrice)
          ) / newQuantity;
          
          await storage.updatePosition(existingPosition.id, newQuantity, newAveragePrice);
        } else {
          // Create new position
          await storage.createPosition({
            symbol: order.symbol,
            exchange: order.exchange,
            quantity: order.quantity,
            averagePrice: executionPrice.toFixed(2),
            userId: order.userId
          });
        }

        // Deduct cash from user balance
        const user = await storage.getUser(order.userId);
        if (user) {
          const newBalance = parseFloat(user.balance) - totalValue;
          await storage.updateUserBalance(order.userId, newBalance);
        }
      } else if (order.orderType === "SELL" && existingPosition) {
        // Handle sell order
        const newQuantity = existingPosition.quantity - order.quantity;
        
        if (newQuantity <= 0) {
          await storage.deletePosition(existingPosition.id);
        } else {
          await storage.updatePosition(existingPosition.id, newQuantity, parseFloat(existingPosition.averagePrice));
        }

        // Add cash to user balance
        const user = await storage.getUser(order.userId);
        if (user) {
          const newBalance = parseFloat(user.balance) + totalValue;
          await storage.updateUserBalance(order.userId, newBalance);
        }
      }
    } catch (error) {
      console.error("Failed to execute order:", error);
    }
  }

  // Get user orders
  app.get("/api/orders", async (req, res) => {
    try {
      const userId = 1; // Demo user ID
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get active orders
  app.get("/api/orders/active", async (req, res) => {
    try {
      const userId = 1; // Demo user ID
      const orders = await storage.getActiveOrders(userId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active orders" });
    }
  });

  // Cancel order
  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      await storage.cancelOrder(orderId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel order" });
    }
  });

  // Get user positions
  app.get("/api/positions", async (req, res) => {
    try {
      const userId = 1; // Demo user ID
      const positions = await storage.getUserPositions(userId);
      
      // Calculate current values and P&L
      const enrichedPositions = await Promise.all(
        positions.map(async (position) => {
          try {
            const priceData = await fetchStockPrice(position.symbol, position.exchange);
            const currentValue = position.quantity * priceData.currentPrice;
            const investment = position.quantity * parseFloat(position.averagePrice);
            const unrealizedPnL = currentValue - investment;
            const unrealizedPnLPercent = (unrealizedPnL / investment) * 100;

            return {
              ...position,
              currentPrice: priceData.currentPrice,
              currentValue,
              unrealizedPnL,
              unrealizedPnLPercent
            };
          } catch (error) {
            return {
              ...position,
              currentPrice: parseFloat(position.averagePrice),
              currentValue: parseFloat(position.currentValue),
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0
            };
          }
        })
      );

      res.json(enrichedPositions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  // Get portfolio summary
  app.get("/api/portfolio", async (req, res) => {
    try {
      const userId = 1; // Demo user ID
      const user = await storage.getUser(userId);
      const positions = await storage.getUserPositions(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let totalValue = parseFloat(user.balance);
      let totalInvestment = 0;
      let totalPnL = 0;

      const enrichedPositions = await Promise.all(
        positions.map(async (position) => {
          try {
            const priceData = await fetchStockPrice(position.symbol, position.exchange);
            const currentValue = position.quantity * priceData.currentPrice;
            const investment = position.quantity * parseFloat(position.averagePrice);
            const unrealizedPnL = currentValue - investment;
            const unrealizedPnLPercent = (unrealizedPnL / investment) * 100;

            totalValue += currentValue;
            totalInvestment += investment;
            totalPnL += unrealizedPnL;

            return {
              symbol: position.symbol,
              exchange: position.exchange,
              quantity: position.quantity,
              averagePrice: parseFloat(position.averagePrice),
              currentPrice: priceData.currentPrice,
              currentValue,
              unrealizedPnL,
              unrealizedPnLPercent
            };
          } catch (error) {
            const currentValue = parseFloat(position.currentValue);
            totalValue += currentValue;
            totalInvestment += currentValue;

            return {
              symbol: position.symbol,
              exchange: position.exchange,
              quantity: position.quantity,
              averagePrice: parseFloat(position.averagePrice),
              currentPrice: parseFloat(position.averagePrice),
              currentValue,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0
            };
          }
        })
      );

      const totalPnLPercent = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

      const summary = {
        totalValue,
        totalInvestment,
        totalPnL,
        totalPnLPercent,
        availableCash: parseFloat(user.balance),
        positions: enrichedPositions
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio summary" });
    }
  });

  // Get user trades
  app.get("/api/trades", async (req, res) => {
    try {
      const userId = 1; // Demo user ID
      const trades = await storage.getUserTrades(userId);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  // Background process to check and execute pending orders
  setInterval(async () => {
    try {
      const activeOrders = await storage.getActiveOrders(1); // Demo user ID
      
      for (const order of activeOrders) {
        try {
          const priceData = await fetchStockPrice(order.symbol, order.exchange);
          const currentPrice = priceData.currentPrice;
          const limitPrice = parseFloat(order.limitPrice);
          
          let shouldExecute = false;
          if (order.orderType === "BUY" && currentPrice <= limitPrice) {
            shouldExecute = true;
          } else if (order.orderType === "SELL" && currentPrice >= limitPrice) {
            shouldExecute = true;
          }

          if (shouldExecute) {
            await executeOrder(order.id, currentPrice);
          }
        } catch (error) {
          console.error(`Failed to check order ${order.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to process pending orders:", error);
    }
  }, 5000); // Check every 5 seconds

  const httpServer = createServer(app);
  return httpServer;
}
