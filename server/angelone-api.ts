import axios from 'axios';

interface AngelOneConfig {
  apiKey: string;
  clientId: string;
  apiSecret: string;
  redirectUrl: string;
}

interface TokenResponse {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
}

interface StockQuote {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ltp: number;
  volume: number;
}

export class AngelOneAPI {
  private config: AngelOneConfig;
  private jwtToken: string | null = null;
  private refreshToken: string | null = null;
  private feedToken: string | null = null;
  private baseUrl = 'https://apiconnect.angelbroking.com';

  constructor(config: AngelOneConfig) {
    this.config = config;
  }

  async login(clientCode: string, password: string, totp: string): Promise<TokenResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`, {
        clientcode: clientCode,
        password: password,
        totp: totp
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '192.168.1.1',
          'X-ClientPublicIP': '192.168.1.1',
          'X-MACAddress': '00:00:00:00:00:00',
          'X-PrivateKey': this.config.apiKey
        }
      });

      if (response.data.status && response.data.data) {
        this.jwtToken = response.data.data.jwtToken;
        this.refreshToken = response.data.data.refreshToken;
        this.feedToken = response.data.data.feedToken;
        
        return {
          jwtToken: this.jwtToken,
          refreshToken: this.refreshToken,
          feedToken: this.feedToken
        };
      }
      
      throw new Error(response.data.message || 'Login failed');
    } catch (error: any) {
      throw new Error(`Angel One login failed: ${error.message}`);
    }
  }

  async getQuote(exchange: string, symboltoken: string): Promise<StockQuote> {
    if (!this.jwtToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/rest/secure/angelbroking/order/v1/getLTP`, {
        exchange: exchange,
        symboltoken: symboltoken,
        tradingsymbol: ""
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '192.168.1.1',
          'X-ClientPublicIP': '192.168.1.1',
          'X-MACAddress': '00:00:00:00:00:00',
          'X-PrivateKey': this.config.apiKey,
          'Authorization': `Bearer ${this.jwtToken}`
        }
      });

      if (response.data.status && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.message || 'Failed to get quote');
    } catch (error: any) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  async searchScrips(searchtext: string): Promise<any[]> {
    if (!this.jwtToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/rest/secure/angelbroking/order/v1/searchscrip`, {
        searchtext: searchtext
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '192.168.1.1',
          'X-ClientPublicIP': '192.168.1.1',
          'X-MACAddress': '00:00:00:00:00:00',
          'X-PrivateKey': this.config.apiKey,
          'Authorization': `Bearer ${this.jwtToken}`
        }
      });

      if (response.data.status && response.data.data) {
        return response.data.data;
      }
      
      return [];
    } catch (error: any) {
      console.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  isAuthenticated(): boolean {
    return !!this.jwtToken;
  }

  setTokens(jwtToken: string, refreshToken: string, feedToken: string) {
    this.jwtToken = jwtToken;
    this.refreshToken = refreshToken;
    this.feedToken = feedToken;
  }
}

// Stock symbol to token mapping for popular stocks
export const STOCK_TOKENS: Record<string, { token: string; exchange: string }> = {
  'RELIANCE': { token: '2885', exchange: 'NSE' },
  'TCS': { token: '11536', exchange: 'NSE' },
  'INFY': { token: '1594', exchange: 'NSE' },
  'HDFCBANK': { token: '1333', exchange: 'NSE' },
  'ICICIBANK': { token: '4963', exchange: 'NSE' },
  'WIPRO': { token: '3787', exchange: 'NSE' },
  'SBIN': { token: '3045', exchange: 'NSE' },
  'LT': { token: '11483', exchange: 'NSE' },
  'KOTAKBANK': { token: '1922', exchange: 'NSE' },
  'AXISBANK': { token: '5900', exchange: 'NSE' }
};