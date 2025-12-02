
import { GoogleGenAI, Type } from "@google/genai";
import { Subscription, Department, Wallet, AllocationType, InvoiceData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeSpending = async (
  subscriptions: Subscription[],
  departments: Department[],
  wallets: Wallet[]
) => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Cannot perform AI analysis.";
  }

  // Helper to describe cost distribution for the AI
  const getDeptContext = (sub: Subscription) => {
    if (sub.allocationType === AllocationType.SINGLE) {
      const d = departments.find(d => d.id === sub.departments[0]?.departmentId);
      return `100% to ${d?.name || 'Unknown'}`;
    } else if (sub.allocationType === AllocationType.EQUAL) {
      const names = sub.departments.map(sd => departments.find(d => d.id === sd.departmentId)?.name).join(', ');
      return `Split equally between: ${names}`;
    } else {
      return `Split by %: ` + sub.departments.map(sd => {
        const d = departments.find(dep => dep.id === sd.departmentId);
        return `${d?.name} (${sd.percentage}%)`;
      }).join(', ');
    }
  };

  const dataContext = JSON.stringify({
    currency: 'SAR',
    subscriptions: subscriptions.map(s => ({
      name: s.name,
      cost: s.baseAmount,
      cycle: s.billingCycle,
      allocation: getDeptContext(s),
      renewal: s.nextRenewalDate
    })),
    wallets: wallets.map(w => ({ name: w.name, balance: w.balance, type: w.type }))
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Analyze the following subscription and wallet data for a company (Currency: SAR - Saudi Riyal). 
        Provide a concise executive summary in markdown.
        
        1. Identify the department with the highest effective spend (account for splits).
        2. Flag any subscriptions that seem redundant or unusually expensive.
        3. Suggest a budget optimization strategy based on the current wallet balances.
        4. List upcoming renewals that need attention (within 30 days).

        Data: ${dataContext}
      `,
      config: {
        thinkingConfig: { thinkingBudget: 1024 }
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return "Failed to generate insights at this time.";
  }
};

export const parseInvoiceDocument = async (base64Data: string, mimeType: string): Promise<Partial<InvoiceData> | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: "Analyze this invoice document. Extract the Date, Vendor Name, Net/Base Amount, VAT Amount, Total Amount, and a list of Line Items (Description and Amount for each). Return JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Invoice date in YYYY-MM-DD format" },
            vendorName: { type: Type.STRING, description: "Name of the service provider or vendor" },
            baseAmount: { type: Type.NUMBER, description: "The amount before tax" },
            vatAmount: { type: Type.NUMBER, description: "The tax amount" },
            totalAmount: { type: Type.NUMBER, description: "The total amount including tax" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("OCR Extraction Failed:", error);
    return null;
  }
};
