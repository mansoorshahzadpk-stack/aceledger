import { supabase } from "@/integrations/supabase/client";

export interface IncomeStatementInput {
  businessId: string;
  userId: string;
  fromDate: string;
  toDate: string;
}

export interface IncomeStatementResult {
  revenue: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  totalMinorIncomes: number;
  netProfit: number;
  expensesByCategory: Record<string, number>;
  minorIncomesByCategory: Record<string, number>;
  opExpensesList: any[];
  minorIncomesList: any[];
}

export async function getIncomeStatementFn(input: IncomeStatementInput): Promise<IncomeStatementResult> {
  const { businessId, userId, fromDate, toDate } = input;

  // Fetch posted invoices in date range
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select("id, total, status, issue_date")
    .eq("status", "posted")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .gte("issue_date", fromDate)
    .lte("issue_date", toDate);

  if (invError) throw invError;

  // Fetch posted GRNs in date range
  const { data: grns, error: grnError } = await supabase
    .from("vendor_grns")
    .select("id, total_amount, status, grn_date")
    .eq("status", "posted")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .gte("grn_date", fromDate)
    .lte("grn_date", toDate);

  if (grnError) throw grnError;

  // Fetch ledger transactions in date range
  const { data: ledgerTxs, error: ledgerError } = await supabase
    .from("ledger_transactions")
    .select("id, amount, category, type, transaction_date")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .gte("transaction_date", fromDate)
    .lte("transaction_date", toDate);

  if (ledgerError) throw ledgerError;

  const revenue = (invoices ?? []).reduce((sum, item) => sum + Number(item.total), 0);
  const cogs = (grns ?? []).reduce((sum, item) => sum + Number(item.total_amount), 0);
  const grossProfit = revenue - cogs;

  const opExpensesList: any[] = [];
  const minorIncomesList: any[] = [];
  const expensesByCategory: Record<string, number> = {};
  const minorIncomesByCategory: Record<string, number> = {};

  (ledgerTxs ?? []).forEach((tx) => {
    const amt = Number(tx.amount);
    if (tx.type === "credit") {
      expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + amt;
      opExpensesList.push(tx);
    } else {
      minorIncomesByCategory[tx.category] = (minorIncomesByCategory[tx.category] || 0) + amt;
      minorIncomesList.push(tx);
    }
  });

  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
  const totalMinorIncomes = Object.values(minorIncomesByCategory).reduce((sum, val) => sum + val, 0);
  const netProfit = grossProfit - totalExpenses + totalMinorIncomes;

  return {
    revenue,
    cogs,
    grossProfit,
    totalExpenses,
    totalMinorIncomes,
    netProfit,
    expensesByCategory,
    minorIncomesByCategory,
    opExpensesList,
    minorIncomesList,
  };
}

export interface BalanceSheetInput {
  businessId: string;
  userId: string;
  asOfDate: string;
}

export interface BalanceSheetResult {
  cashBalances: Array<{ id: string; name: string; type: string; balance: number }>;
  totalCash: number;
  clientBalances: Array<{ id: string; name: string; outstanding: number }>;
  totalReceivables: number;
  vendorBalances: Array<{ id: string; name: string; owed: number }>;
  totalPayables: number;
  totalProperty: number;
  inventoryValue: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}

export async function getBalanceSheetFn(input: BalanceSheetInput): Promise<BalanceSheetResult> {
  const { businessId, userId, asOfDate } = input;

  // 1. Fetch Assets
  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId);

  if (assetsError) throw assetsError;

  // 2. Fetch Client Payments
  const { data: clientPayments, error: clientPaysError } = await supabase
    .from("client_payments")
    .select("amount, asset_id, payment_date, client_id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .lte("payment_date", asOfDate);

  if (clientPaysError) throw clientPaysError;

  // 3. Fetch Vendor Payments
  const { data: vendorPayments, error: vendorPaysError } = await supabase
    .from("vendor_payments")
    .select("amount, asset_id, payment_date, vendor_id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .lte("payment_date", asOfDate);

  if (vendorPaysError) throw vendorPaysError;

  // 4. Fetch Ledger Transactions
  const { data: ledgerTxs, error: ledgerError } = await supabase
    .from("ledger_transactions")
    .select("amount, asset_id, type, transaction_date")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .lte("transaction_date", asOfDate);

  if (ledgerError) throw ledgerError;

  // Calculate dynamic cash balances
  const cashBalances = (assets ?? [])
    .filter((a) => a.type === "bank_account" || a.type === "petty_cash")
    .map((asset) => {
      const id = asset.id;
      const clientInflow = (clientPayments ?? [])
        .filter((p) => p.asset_id === id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const ledgerInflow = (ledgerTxs ?? [])
        .filter((tx) => tx.asset_id === id && tx.type === "debit")
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const vendorOutflow = (vendorPayments ?? [])
        .filter((p) => p.asset_id === id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const ledgerOutflow = (ledgerTxs ?? [])
        .filter((tx) => tx.asset_id === id && tx.type === "credit")
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      const balance = Number(asset.initial_balance) + clientInflow + ledgerInflow - vendorOutflow - ledgerOutflow;
      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        balance,
      };
    });

  const totalCash = cashBalances.reduce((sum, item) => sum + item.balance, 0);

  // 5. Fetch Client Outstanding Balances (Receivables)
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, opening_balance")
    .eq("business_id", businessId)
    .eq("user_id", userId);

  if (clientsError) throw clientsError;

  const { data: clientInvoices, error: clientInvsError } = await supabase
    .from("invoices")
    .select("id, total, status, issue_date, client_id")
    .eq("status", "posted")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .lte("issue_date", asOfDate);

  if (clientInvsError) throw clientInvsError;

  const clientOutstandingBalances = (clients ?? []).map((c) => {
    const invoicesTotal = (clientInvoices ?? [])
      .filter((inv) => inv.client_id === c.id)
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    const paymentsTotal = (clientPayments ?? [])
      .filter((p) => p.client_id === c.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = Number(c.opening_balance) + invoicesTotal - paymentsTotal;
    return {
      id: c.id,
      name: c.name,
      outstanding,
    };
  });

  const totalReceivables = clientOutstandingBalances.reduce((sum, c) => sum + Math.max(0, c.outstanding), 0);

  // 6. Fetch Vendor Outstanding Balances (Payables)
  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select("id, name, opening_balance")
    .eq("business_id", businessId)
    .eq("user_id", userId);

  if (vendorsError) throw vendorsError;

  const { data: vendorGrns, error: vendorGrnsError } = await supabase
    .from("vendor_grns")
    .select("id, total_amount, status, grn_date, vendor_id, product_id, material, quantity, unit, unit_price")
    .eq("status", "posted")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .lte("grn_date", asOfDate);

  if (vendorGrnsError) throw vendorGrnsError;

  const vendorOwedBalances = (vendors ?? []).map((v) => {
    const grnsTotal = (vendorGrns ?? [])
      .filter((g) => g.vendor_id === v.id)
      .reduce((sum, g) => sum + Number(g.total_amount), 0);
    const paymentsTotal = (vendorPayments ?? [])
      .filter((p) => p.vendor_id === v.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const owed = Number(v.opening_balance) + grnsTotal - paymentsTotal;
    return {
      id: v.id,
      name: v.name,
      owed,
    };
  });

  const totalPayables = vendorOwedBalances.reduce((sum, v) => sum + Math.max(0, v.owed), 0);

  // 7. Property & Equipment Valuations
  const totalProperty = (assets ?? [])
    .filter((a) => a.type === "property_equipment")
    .reduce((sum, a) => sum + Number(a.current_valuation), 0);

  // 8. Warehouse Inventory Value Calculation as of Date
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, unit")
    .eq("business_id", businessId)
    .eq("user_id", userId);

  if (productsError) throw productsError;

  const postedInvoiceIds = (clientInvoices ?? []).map((i) => i.id);
  let invoiceItems: any[] = [];
  if (postedInvoiceIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("id, product_id, quantity, description, invoice_id")
      .in("invoice_id", postedInvoiceIds);
    if (itemsError) throw itemsError;
    invoiceItems = items ?? [];
  }

  // Weighted Average Cost calculation
  const materialMap = new Map<string, { name: string; sku: string | null; unit: string; received: number; delivered: number; receivedValue: number }>();
  
  (products ?? []).forEach((m) => {
    materialMap.set(m.id, { name: m.name, sku: m.sku, unit: m.unit, received: 0, delivered: 0, receivedValue: 0 });
  });

  (vendorGrns ?? []).forEach((g) => {
    const key = g.product_id ?? `_name:${(g.material || "").toLowerCase().trim()}`;
    let row = materialMap.get(key);
    if (!row) {
      row = { name: g.material || "(unlinked)", sku: null, unit: g.unit || "", received: 0, delivered: 0, receivedValue: 0 };
      materialMap.set(key, row);
    }
    row.received += Number(g.quantity);
    row.receivedValue += Number(g.total_amount);
  });

  invoiceItems.forEach((it) => {
    const key = it.product_id ?? `_name:${(it.description || "").toLowerCase().trim().split(" (")[0]}`;
    const row = materialMap.get(key);
    if (row) {
      row.delivered += Number(it.quantity);
    }
  });

  let totalInventoryValue = 0;
  materialMap.forEach((r) => {
    const onHand = r.received - r.delivered;
    const avgCost = r.received > 0 ? r.receivedValue / r.received : 0;
    const val = onHand > 0 ? onHand * avgCost : 0;
    totalInventoryValue += val;
  });

  // 9. Final equations
  const totalAssets = totalCash + totalReceivables + totalInventoryValue + totalProperty;
  const totalLiabilities = totalPayables;
  const equity = totalAssets - totalLiabilities;

  return {
    cashBalances,
    totalCash,
    clientBalances: clientOutstandingBalances,
    totalReceivables,
    vendorBalances: vendorOwedBalances,
    totalPayables,
    totalProperty,
    inventoryValue: totalInventoryValue,
    totalAssets,
    totalLiabilities,
    equity,
  };
}
