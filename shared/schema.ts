import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("100000.00"),
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(), // NSE or BSE
  name: text("name").notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  previousClose: decimal("previous_close", { precision: 10, scale: 2 }).notNull(),
  dayHigh: decimal("day_high", { precision: 10, scale: 2 }).notNull(),
  dayLow: decimal("day_low", { precision: 10, scale: 2 }).notNull(),
  dayOpen: decimal("day_open", { precision: 10, scale: 2 }).notNull(),
  volume: integer("volume").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(),
  orderType: text("order_type").notNull(), // BUY or SELL
  quantity: integer("quantity").notNull(),
  limitPrice: decimal("limit_price", { precision: 10, scale: 2 }).notNull(),
  takeProfitType: text("take_profit_type"), // PERCENTAGE or ABSOLUTE
  takeProfitValue: decimal("take_profit_value", { precision: 10, scale: 2 }),
  stopLossType: text("stop_loss_type"), // PERCENTAGE or ABSOLUTE
  stopLossValue: decimal("stop_loss_value", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("PENDING"), // PENDING, EXECUTED, CANCELLED
  executedPrice: decimal("executed_price", { precision: 10, scale: 2 }),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(),
  quantity: integer("quantity").notNull(),
  averagePrice: decimal("average_price", { precision: 10, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 12, scale: 2 }).notNull(),
  unrealizedPnL: decimal("unrealized_pnl", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  orderId: integer("order_id").notNull(),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(),
  tradeType: text("trade_type").notNull(), // BUY or SELL
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull(),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  balance: true,
});

export const insertStockSchema = createInsertSchema(stocks).omit({
  id: true,
  lastUpdated: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  userId: true,
  status: true,
  executedPrice: true,
  executedAt: true,
  createdAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  userId: true,
  currentValue: true,
  unrealizedPnL: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  userId: true,
  executedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

// Additional schemas for API responses
export const stockPriceSchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  currentPrice: z.number(),
  change: z.number(),
  changePercent: z.number(),
  dayHigh: z.number(),
  dayLow: z.number(),
  dayOpen: z.number(),
  previousClose: z.number(),
  volume: z.number(),
});

export type StockPrice = z.infer<typeof stockPriceSchema>;

export const portfolioSummarySchema = z.object({
  totalValue: z.number(),
  totalInvestment: z.number(),
  totalPnL: z.number(),
  totalPnLPercent: z.number(),
  availableCash: z.number(),
  positions: z.array(z.object({
    symbol: z.string(),
    exchange: z.string(),
    quantity: z.number(),
    averagePrice: z.number(),
    currentPrice: z.number(),
    currentValue: z.number(),
    unrealizedPnL: z.number(),
    unrealizedPnLPercent: z.number(),
  })),
});

export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;
