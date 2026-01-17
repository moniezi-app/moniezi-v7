
import { GoogleGenAI } from "@google/genai";
import { Transaction, Invoice } from "../types";

export const getFinancialInsights = async (transactions: Transaction[], invoices: Invoice[], taxRate: number = 25) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const unpaidAmount = invoices.filter(i => i.status === 'unpaid').reduce((sum, i) => sum + i.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const estimatedTax = netProfit > 0 ? netProfit * (taxRate / 100) : 0;

  const prompt = `
    Role: You are a sharp, proactive CFO assistant for a freelancer/small business owner.
    
    Data Snapshot:
    - Income: $${totalIncome.toFixed(2)}
    - Expenses: $${totalExpense.toFixed(2)}
    - Net Profit: $${netProfit.toFixed(2)}
    - Pending Invoices: $${unpaidAmount.toFixed(2)}
    - User's Tax Rate: ${taxRate}%
    - Estimated Tax Liability: $${estimatedTax.toFixed(2)}
    
    Recent 3 Transactions: ${JSON.stringify(transactions.slice(0, 3).map(t => ({name: t.name, amount: t.amount, type: t.type})))}

    Task: Provide a 2-sentence actionable financial insight. 
    1. If profit is healthy, mention the tax liability to set aside.
    2. If expenses are high, point out the largest category.
    3. If invoices are pending, suggest a polite chase-up strategy.
    
    Tone: Professional, concise, slightly witty.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "I'm having trouble connecting to the financial brain. Please check your connection and try again.";
  }
};