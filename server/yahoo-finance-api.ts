import fetch from 'node-fetch';

interface YahooQuoteData {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketOpen: number;
  regularMarketPreviousClose: number;
  regularMarketVolume: number;
  marketState: string;
}

interface YahooSearchResult {
  symbol: string;
  shortname: string;
  longname: string;
  exchange: string;
  quoteType: string;
}

export class YahooFinanceAPI {
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/';
  private searchUrl = 'https://query1.finance.yahoo.com/v1/finance/search';

  // Convert NSE/BSE symbols to Yahoo Finance format
  private formatSymbol(symbol: string, exchange: string): string {
    if (exchange === 'NSE') {
      return `${symbol}.NS`;
    } else if (exchange === 'BSE') {
      return `${symbol}.BO`;
    }
    return symbol;
  }

  async getQuote(symbol: string, exchange: string): Promise<YahooQuoteData> {
    const yahooSymbol = this.formatSymbol(symbol, exchange);
    
    try {
      const response = await fetch(`${this.baseUrl}${yahooSymbol}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error('No data found for symbol');
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators.quote[0];

      return {
        symbol: yahooSymbol,
        regularMarketPrice: meta.regularMarketPrice || 0,
        regularMarketChange: meta.regularMarketPrice - meta.previousClose || 0,
        regularMarketChangePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) || 0,
        regularMarketDayHigh: meta.regularMarketDayHigh || 0,
        regularMarketDayLow: meta.regularMarketDayLow || 0,
        regularMarketOpen: meta.regularMarketDayLow || 0,
        regularMarketPreviousClose: meta.previousClose || 0,
        regularMarketVolume: meta.regularMarketVolume || 0,
        marketState: meta.marketState || 'REGULAR'
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch quote for ${yahooSymbol}: ${error.message}`);
    }
  }

  async searchSymbols(query: string): Promise<YahooSearchResult[]> {
    try {
      const response = await fetch(`${this.searchUrl}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance search error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.quotes) {
        return [];
      }

      // Filter for Indian stocks (NSE/BSE)
      return data.quotes
        .filter((quote: any) => 
          quote.symbol && 
          (quote.symbol.endsWith('.NS') || quote.symbol.endsWith('.BO')) &&
          quote.quoteType === 'EQUITY'
        )
        .map((quote: any) => ({
          symbol: quote.symbol,
          shortname: quote.shortname || '',
          longname: quote.longname || quote.shortname || '',
          exchange: quote.exchange || (quote.symbol.endsWith('.NS') ? 'NSE' : 'BSE'),
          quoteType: quote.quoteType
        }));
    } catch (error: any) {
      console.error('Yahoo Finance search error:', error.message);
      return [];
    }
  }

  // Extract base symbol from Yahoo format (RELIANCE.NS -> RELIANCE)
  extractBaseSymbol(yahooSymbol: string): { symbol: string; exchange: string } {
    if (yahooSymbol.endsWith('.NS')) {
      return {
        symbol: yahooSymbol.replace('.NS', ''),
        exchange: 'NSE'
      };
    } else if (yahooSymbol.endsWith('.BO')) {
      return {
        symbol: yahooSymbol.replace('.BO', ''),
        exchange: 'BSE'
      };
    }
    return { symbol: yahooSymbol, exchange: 'NSE' };
  }
}