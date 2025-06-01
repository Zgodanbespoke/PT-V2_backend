import { users, stocks, orders, positions, trades, type User, type InsertUser, type Stock, type InsertStock, type Order, type InsertOrder, type Position, type InsertPosition, type Trade, type InsertTrade } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, balance: number): Promise<void>;

  // Stock operations
  getStock(symbol: string, exchange: string): Promise<Stock | undefined>;
  getAllStocks(): Promise<Stock[]>;
  upsertStock(stock: InsertStock): Promise<Stock>;
  updateStockPrice(symbol: string, exchange: string, price: number): Promise<void>;
  searchStocks(query: string): Promise<Stock[]>;

  // Order operations
  createOrder(order: InsertOrder & { userId: number }): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getUserOrders(userId: number): Promise<Order[]>;
  getActiveOrders(userId: number): Promise<Order[]>;
  updateOrderStatus(orderId: number, status: string, executedPrice?: number): Promise<void>;
  cancelOrder(orderId: number): Promise<void>;

  // Position operations
  getUserPositions(userId: number): Promise<Position[]>;
  getPosition(userId: number, symbol: string, exchange: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition & { userId: number }): Promise<Position>;
  updatePosition(positionId: number, quantity: number, averagePrice: number): Promise<void>;
  deletePosition(positionId: number): Promise<void>;

  // Trade operations
  createTrade(trade: InsertTrade & { userId: number }): Promise<Trade>;
  getUserTrades(userId: number): Promise<Trade[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private stocks: Map<string, Stock>; // key: symbol-exchange
  private orders: Map<number, Order>;
  private positions: Map<number, Position>;
  private trades: Map<number, Trade>;
  private currentUserId: number;
  private currentOrderId: number;
  private currentPositionId: number;
  private currentTradeId: number;
  private currentStockId: number;

  constructor() {
    this.users = new Map();
    this.stocks = new Map();
    this.orders = new Map();
    this.positions = new Map();
    this.trades = new Map();
    this.currentUserId = 1;
    this.currentOrderId = 1;
    this.currentPositionId = 1;
    this.currentTradeId = 1;
    this.currentStockId = 1;

    // Initialize with demo user and stocks
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo user
    const demoUser: User = {
      id: 1,
      username: "demo",
      password: "demo123",
      balance: "100000.00"
    };
    this.users.set(1, demoUser);
    this.currentUserId = 2;

    // Initialize popular stocks
    const demoStocks: Stock[] = [
      {
        id: 1,
        symbol: "RELIANCE",
        exchange: "NSE",
        name: "Reliance Industries Limited",
        currentPrice: "2456.75",
        previousClose: "2444.30",
        dayHigh: "2461.80",
        dayLow: "2438.50",
        dayOpen: "2444.30",
        volume: 1250000,
        lastUpdated: new Date()
      },
      {
        id: 2,
        symbol: "TCS",
        exchange: "NSE",
        name: "Tata Consultancy Services",
        currentPrice: "3710.25",
        previousClose: "3698.50",
        dayHigh: "3725.00",
        dayLow: "3695.00",
        dayOpen: "3700.00",
        volume: 890000,
        lastUpdated: new Date()
      },
      {
        id: 3,
        symbol: "INFY",
        exchange: "NSE",
        name: "Infosys Limited",
        currentPrice: "1530.40",
        previousClose: "1518.10",
        dayHigh: "1535.80",
        dayLow: "1515.20",
        dayOpen: "1520.00",
        volume: 1150000,
        lastUpdated: new Date()
      },
      {
        id: 4,
        symbol: "HDFCBANK",
        exchange: "NSE",
        name: "HDFC Bank Limited",
        currentPrice: "1632.45",
        previousClose: "1641.20",
        dayHigh: "1645.20",
        dayLow: "1628.30",
        dayOpen: "1640.00",
        volume: 750000,
        lastUpdated: new Date()
      },
      {
        id: 5,
        symbol: "ICICIBANK",
        exchange: "NSE",
        name: "ICICI Bank Limited",
        currentPrice: "1245.60",
        previousClose: "1238.90",
        dayHigh: "1252.30",
        dayLow: "1235.40",
        dayOpen: "1240.00",
        volume: 980000,
        lastUpdated: new Date()
      }
    ];

    demoStocks.forEach(stock => {
      this.stocks.set(`${stock.symbol}-${stock.exchange}`, stock);
    });
    this.currentStockId = 6;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, balance: "100000.00" };
    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(userId: number, balance: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.balance = balance.toFixed(2);
      this.users.set(userId, user);
    }
  }

  // Stock operations
  async getStock(symbol: string, exchange: string): Promise<Stock | undefined> {
    return this.stocks.get(`${symbol}-${exchange}`);
  }

  async getAllStocks(): Promise<Stock[]> {
    return Array.from(this.stocks.values());
  }

  async upsertStock(insertStock: InsertStock): Promise<Stock> {
    const key = `${insertStock.symbol}-${insertStock.exchange}`;
    const existing = this.stocks.get(key);
    
    if (existing) {
      const updated: Stock = { ...existing, ...insertStock, lastUpdated: new Date() };
      this.stocks.set(key, updated);
      return updated;
    } else {
      const id = this.currentStockId++;
      const stock: Stock = { ...insertStock, id, volume: insertStock.volume || 0, lastUpdated: new Date() };
      this.stocks.set(key, stock);
      return stock;
    }
  }

  async updateStockPrice(symbol: string, exchange: string, price: number): Promise<void> {
    const key = `${symbol}-${exchange}`;
    const stock = this.stocks.get(key);
    if (stock) {
      stock.currentPrice = price.toFixed(2);
      stock.lastUpdated = new Date();
      this.stocks.set(key, stock);
    }
  }

  async searchStocks(query: string): Promise<Stock[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.stocks.values()).filter(stock => 
      stock.symbol.toLowerCase().includes(searchTerm) || 
      stock.name.toLowerCase().includes(searchTerm)
    );
  }

  // Order operations
  async createOrder(order: InsertOrder & { userId: number }): Promise<Order> {
    const id = this.currentOrderId++;
    const newOrder: Order = {
      ...order,
      id,
      status: "PENDING",
      executedPrice: null,
      executedAt: null,
      createdAt: new Date(),
      takeProfitType: order.takeProfitType || null,
      takeProfitValue: order.takeProfitValue || null,
      stopLossType: order.stopLossType || null,
      stopLossValue: order.stopLossValue || null
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveOrders(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.userId === userId && order.status === "PENDING");
  }

  async updateOrderStatus(orderId: number, status: string, executedPrice?: number): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      if (executedPrice !== undefined) {
        order.executedPrice = executedPrice.toFixed(2);
        order.executedAt = new Date();
      }
      this.orders.set(orderId, order);
    }
  }

  async cancelOrder(orderId: number): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = "CANCELLED";
      this.orders.set(orderId, order);
    }
  }

  // Position operations
  async getUserPositions(userId: number): Promise<Position[]> {
    return Array.from(this.positions.values())
      .filter(position => position.userId === userId);
  }

  async getPosition(userId: number, symbol: string, exchange: string): Promise<Position | undefined> {
    return Array.from(this.positions.values())
      .find(position => 
        position.userId === userId && 
        position.symbol === symbol && 
        position.exchange === exchange
      );
  }

  async createPosition(position: InsertPosition & { userId: number }): Promise<Position> {
    const id = this.currentPositionId++;
    const newPosition: Position = {
      ...position,
      id,
      currentValue: (position.quantity * parseFloat(position.averagePrice)).toFixed(2),
      unrealizedPnL: "0.00",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.positions.set(id, newPosition);
    return newPosition;
  }

  async updatePosition(positionId: number, quantity: number, averagePrice: number): Promise<void> {
    const position = this.positions.get(positionId);
    if (position) {
      position.quantity = quantity;
      position.averagePrice = averagePrice.toFixed(2);
      position.currentValue = (quantity * averagePrice).toFixed(2);
      position.updatedAt = new Date();
      this.positions.set(positionId, position);
    }
  }

  async deletePosition(positionId: number): Promise<void> {
    this.positions.delete(positionId);
  }

  // Trade operations
  async createTrade(trade: InsertTrade & { userId: number }): Promise<Trade> {
    const id = this.currentTradeId++;
    const newTrade: Trade = {
      ...trade,
      id,
      executedAt: new Date()
    };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async getUserTrades(userId: number): Promise<Trade[]> {
    return Array.from(this.trades.values())
      .filter(trade => trade.userId === userId)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserBalance(userId: number, balance: number): Promise<void> {
    await db
      .update(users)
      .set({ balance: balance.toFixed(2) })
      .where(eq(users.id, userId));
  }

  async getStock(symbol: string, exchange: string): Promise<Stock | undefined> {
    const [stock] = await db
      .select()
      .from(stocks)
      .where(and(eq(stocks.symbol, symbol), eq(stocks.exchange, exchange)));
    return stock || undefined;
  }

  async getAllStocks(): Promise<Stock[]> {
    return await db.select().from(stocks);
  }

  async upsertStock(insertStock: InsertStock): Promise<Stock> {
    const existing = await this.getStock(insertStock.symbol, insertStock.exchange);
    
    if (existing) {
      const [updated] = await db
        .update(stocks)
        .set({ ...insertStock, lastUpdated: new Date() })
        .where(and(eq(stocks.symbol, insertStock.symbol), eq(stocks.exchange, insertStock.exchange)))
        .returning();
      return updated;
    } else {
      const [stock] = await db
        .insert(stocks)
        .values({ ...insertStock, volume: insertStock.volume || 0, lastUpdated: new Date() })
        .returning();
      return stock;
    }
  }

  async updateStockPrice(symbol: string, exchange: string, price: number): Promise<void> {
    await db
      .update(stocks)
      .set({ 
        currentPrice: price.toFixed(2), 
        lastUpdated: new Date() 
      })
      .where(and(eq(stocks.symbol, symbol), eq(stocks.exchange, exchange)));
  }

  async searchStocks(query: string): Promise<Stock[]> {
    return await db
      .select()
      .from(stocks)
      .where(
        ilike(stocks.symbol, `%${query}%`)
      );
  }

  async createOrder(order: InsertOrder & { userId: number }): Promise<Order> {
    const [newOrder] = await db
      .insert(orders)
      .values({
        ...order,
        status: "PENDING",
        executedPrice: null,
        executedAt: null,
        createdAt: new Date(),
        takeProfitType: order.takeProfitType || null,
        takeProfitValue: order.takeProfitValue || null,
        stopLossType: order.stopLossType || null,
        stopLossValue: order.stopLossValue || null
      })
      .returning();
    return newOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getActiveOrders(userId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "PENDING")));
  }

  async updateOrderStatus(orderId: number, status: string, executedPrice?: number): Promise<void> {
    await db
      .update(orders)
      .set({
        status,
        executedPrice: executedPrice ? executedPrice.toFixed(2) : null,
        executedAt: executedPrice ? new Date() : null
      })
      .where(eq(orders.id, orderId));
  }

  async cancelOrder(orderId: number): Promise<void> {
    await db
      .update(orders)
      .set({ status: "CANCELLED" })
      .where(eq(orders.id, orderId));
  }

  async getUserPositions(userId: number): Promise<Position[]> {
    return await db
      .select()
      .from(positions)
      .where(eq(positions.userId, userId));
  }

  async getPosition(userId: number, symbol: string, exchange: string): Promise<Position | undefined> {
    const [position] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.userId, userId),
          eq(positions.symbol, symbol),
          eq(positions.exchange, exchange)
        )
      );
    return position || undefined;
  }

  async createPosition(position: InsertPosition & { userId: number }): Promise<Position> {
    const [newPosition] = await db
      .insert(positions)
      .values({
        ...position,
        currentValue: (position.quantity * parseFloat(position.averagePrice)).toFixed(2),
        unrealizedPnL: "0.00",
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newPosition;
  }

  async updatePosition(positionId: number, quantity: number, averagePrice: number): Promise<void> {
    await db
      .update(positions)
      .set({
        quantity,
        averagePrice: averagePrice.toFixed(2),
        currentValue: (quantity * averagePrice).toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(positions.id, positionId));
  }

  async deletePosition(positionId: number): Promise<void> {
    await db.delete(positions).where(eq(positions.id, positionId));
  }

  async createTrade(trade: InsertTrade & { userId: number }): Promise<Trade> {
    const [newTrade] = await db
      .insert(trades)
      .values({
        ...trade,
        executedAt: new Date()
      })
      .returning();
    return newTrade;
  }

  async getUserTrades(userId: number): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId))
      .orderBy(desc(trades.executedAt));
  }
}

export const storage = new DatabaseStorage();
