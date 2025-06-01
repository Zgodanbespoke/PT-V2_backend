import { db } from "./db";
import { users, stocks } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function initializeDatabase() {
  try {
    // Check if demo user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.username, "demo"));
    
    if (!existingUser) {
      // Create demo user
      await db.insert(users).values({
        username: "demo",
        password: "demo123",
        balance: "100000.00"
      });
      console.log("Demo user created");
    }

    // Check if stocks are already initialized
    const existingStocks = await db.select().from(stocks);
    
    if (existingStocks.length === 0) {
      // Initialize popular Indian stocks
      const initialStocks = [
        {
          symbol: "RELIANCE",
          exchange: "NSE",
          name: "Reliance Industries Limited",
          currentPrice: "2456.75",
          previousClose: "2444.30",
          dayHigh: "2461.80",
          dayLow: "2438.50",
          dayOpen: "2444.30",
          volume: 1250000
        },
        {
          symbol: "TCS",
          exchange: "NSE",
          name: "Tata Consultancy Services",
          currentPrice: "3710.25",
          previousClose: "3698.50",
          dayHigh: "3725.00",
          dayLow: "3695.00",
          dayOpen: "3700.00",
          volume: 890000
        },
        {
          symbol: "INFY",
          exchange: "NSE",
          name: "Infosys Limited",
          currentPrice: "1530.40",
          previousClose: "1518.10",
          dayHigh: "1535.80",
          dayLow: "1515.20",
          dayOpen: "1520.00",
          volume: 1150000
        },
        {
          symbol: "HDFCBANK",
          exchange: "NSE",
          name: "HDFC Bank Limited",
          currentPrice: "1632.45",
          previousClose: "1641.20",
          dayHigh: "1645.20",
          dayLow: "1628.30",
          dayOpen: "1640.00",
          volume: 750000
        },
        {
          symbol: "ICICIBANK",
          exchange: "NSE",
          name: "ICICI Bank Limited",
          currentPrice: "1245.60",
          previousClose: "1238.90",
          dayHigh: "1252.30",
          dayLow: "1235.40",
          dayOpen: "1240.00",
          volume: 980000
        }
      ];

      for (const stock of initialStocks) {
        await db.insert(stocks).values({
          ...stock,
          lastUpdated: new Date()
        });
      }
      console.log("Initial stocks data inserted");
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}