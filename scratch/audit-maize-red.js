const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function queryTable(table, select = "*") {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${select}`, {
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${table}: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function audit() {
  console.log("=== STARTING MAIZE RED TRANSACTION AUDIT ===");
  
  // 1. Fetch all GRNs and GRN items
  const grns = await queryTable("vendor_grns", "id,grn_number,grn_date,material,quantity,status");
  const grnItems = await queryTable("vendor_grn_items", "id,grn_id,material,quantity");
  
  // 2. Fetch all Invoices and Invoice items
  const invoices = await queryTable("invoices", "id,invoice_number,issue_date,status");
  const invoiceItems = await queryTable("invoice_items", "id,invoice_id,description,quantity");
  
  console.log("\n--- RAW GRNS (PARENT TABLE) ---");
  grns.forEach(g => {
    console.log(`GRN #${g.grn_number} | Date: ${g.grn_date} | Material: ${g.material} | Qty: ${g.quantity} | Status: ${g.status}`);
  });

  console.log("\n--- RAW GRN ITEMS (CHILD TABLE) ---");
  grnItems.forEach(gi => {
    const parent = grns.find(g => g.id === gi.grn_id);
    console.log(`Item ID: ${gi.id} | GRN ID: ${gi.grn_id} (GRN #${parent ? parent.grn_number : 'unknown'}) | Material: ${gi.material} | Qty: ${gi.quantity}`);
  });

  console.log("\n--- RAW INVOICES ---");
  invoices.forEach(inv => {
    console.log(`Invoice #${inv.invoice_number} | Date: ${inv.issue_date} | Status: ${inv.status}`);
  });

  console.log("\n--- RAW INVOICE ITEMS ---");
  invoiceItems.forEach(ii => {
    const parent = invoices.find(inv => inv.id === ii.invoice_id);
    console.log(`Item ID: ${ii.id} | Inv ID: ${ii.invoice_id} (Inv #${parent ? parent.invoice_number : 'unknown'}) | Desc: ${ii.description} | Qty: ${ii.quantity}`);
  });
  
  // 3. Isolated ledger calculation for "Maize Red"
  console.log("\n=== LEDGER CALCULATIONS ===");
  
  const targetMaterial = "Maize Red";
  
  // A. GRNs (Posted parent records)
  console.log(`\nEvaluating GRN parents for "${targetMaterial}" (Posted only):`);
  let grnParentSum = 0;
  grns.forEach(g => {
    if (g.status === "posted" && g.material && g.material.toLowerCase().includes(targetMaterial.toLowerCase())) {
      grnParentSum += Number(g.quantity);
      console.log(`  - GRN #${g.grn_number}: Qty ${g.quantity}`);
    }
  });
  console.log(`Total GRN parent quantity: ${grnParentSum}`);

  // B. GRN Items (Posted child records)
  console.log(`\nEvaluating GRN items for "${targetMaterial}" (Posted only):`);
  let grnItemsSum = 0;
  grnItems.forEach(gi => {
    const parent = grns.find(g => g.id === gi.grn_id);
    const isPosted = parent ? parent.status === "posted" : false;
    if (isPosted && gi.material && gi.material.toLowerCase().includes(targetMaterial.toLowerCase())) {
      grnItemsSum += Number(gi.quantity);
      console.log(`  - GRN #${parent.grn_number} item: Qty ${gi.quantity}`);
    }
  });
  console.log(`Total GRN items quantity: ${grnItemsSum}`);

  // C. Invoice Items (Posted only)
  console.log(`\nEvaluating Invoice items for "${targetMaterial}" (Posted only):`);
  let invoiceItemsSum = 0;
  invoiceItems.forEach(ii => {
    const parent = invoices.find(inv => inv.id === ii.invoice_id);
    const isPosted = parent ? parent.status === "posted" : false;
    if (isPosted && ii.description && ii.description.toLowerCase().includes(targetMaterial.toLowerCase())) {
      invoiceItemsSum += Number(ii.quantity);
      console.log(`  - Inv #${parent.invoice_number}: Qty ${ii.quantity}`);
    }
  });
  console.log(`Total Invoice items quantity (Delivered): ${invoiceItemsSum}`);

  console.log("\n=== DIAGNOSTIC CONCLUSIONS ===");
  console.log(`Using Parent GRNs (Received): ${grnParentSum} Kg`);
  console.log(`Using Child GRN Items (Received): ${grnItemsSum} Kg`);
  console.log(`Delivered (Posted Invoices): ${invoiceItemsSum} Kg`);
  console.log(`\nStock On-Hand (Parent GRN method): ${grnParentSum} - ${invoiceItemsSum} = ${grnParentSum - invoiceItemsSum} Kg`);
  console.log(`Stock On-Hand (Child GRN Items method): ${grnItemsSum} - ${invoiceItemsSum} = ${grnItemsSum - invoiceItemsSum} Kg`);
}

audit().catch(console.error);
