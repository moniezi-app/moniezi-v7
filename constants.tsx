

export const CATS_IN = [
  "Sales / Services",
  "Consulting / Freelance",
  "Product Sales",
  "Affiliate / Referral",
  "Interest / Bank",
  "Refunds",
  "Other Income"
];

export const CATS_OUT = [
  "Advertising / Marketing",
  "Software / SaaS",
  "Rent / Workspace",
  "Utilities",
  "Office Supplies",
  "Phone / Internet",
  "Travel",
  "Meals (Business)",
  "Professional Services",
  "Insurance",
  "Contractors",
  "Payroll",
  "Taxes & Licenses",
  "Equipment",
  "Shipping / Delivery",
  "Bank Fees",
  "Other Expense"
];

export const CATS_BILLING = [
  "Web Development",
  "Graphic Design",
  "Strategy Consulting",
  "Content Writing",
  "Digital Marketing",
  "Maintenance Retainer",
  "Software Licensing",
  "Project Milestone",
  "Training / Workshop",
  "Other Service"
];

export const DEFAULT_PAY_PREFS = [
  "Card", "Bank Transfer", "Cash", "PayPal", "Stripe", "Zelle", "Venmo", "Wise"
];

export const DB_KEY = "moniezi_v7_data";

// --- Tax Constants (2025 Estimates) ---
export const TAX_CONSTANTS = {
  // Estimated 2025 Standard Deductions
  STD_DEDUCTION_SINGLE: 15000, 
  STD_DEDUCTION_JOINT: 30000,
  STD_DEDUCTION_HEAD: 22500,
  // Self Employment Tax (Social Security 12.4% + Medicare 2.9%)
  SE_TAX_RATE: 0.153,
  // Only 92.35% of net earnings are subject to SE tax
  SE_TAXABLE_PORTION: 0.9235 
};

// --- Tax Planner Constants (2026 Estimates) ---
export const TAX_PLANNER_2026 = {
  STD_DEDUCTION_SINGLE: 16100,
  STD_DEDUCTION_JOINT: 32200,
  STD_DEDUCTION_HEAD: 24150,
  SE_TAX_RATE: 0.153
};

// --- Demo Data Generator ---
export const getFreshDemoData = () => {
  // Helper functions
  const randomDate = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  const randomAmount = (min: number, max: number) => {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  };

  const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  let idCounter = 1000;
  const generateId = (prefix: string) => `${prefix}_${idCounter++}`;

  const descriptions: Record<string, string[]> = {
    'Consulting / Freelance': ['Strategy consulting', 'Business analysis', 'Process optimization', 'Market research'],
    'Sales / Services': ['Web development', 'Mobile app', 'API integration', 'Database design'],
    'Product Sales': ['Online store sales', 'E-commerce revenue', 'Digital product sales'],
    'Advertising / Marketing': ['Google Ads', 'Facebook Ads', 'LinkedIn Premium', 'Instagram promotion'],
    'Software / SaaS': ['Adobe Creative Cloud', 'Microsoft 365', 'Slack Premium', 'Zoom Pro'],
    'Rent / Workspace': ['Office rent', 'Co-working space'],
    'Travel': ['Flight to client meeting', 'Hotel - conference', 'Rental car', 'Uber/Lyft'],
    'Meals (Business)': ['Client lunch', 'Team dinner', 'Coffee meeting', 'Conference meals'],
    'Equipment': ['Laptop', 'Monitor', 'Desk chair', 'External hard drive', 'Camera gear']
  };

  const clients = [
    'Acme Corporation', 'TechStart Inc', 'Global Ventures LLC', 'Digital Dreams Co',
    'Blue Ocean Partners', 'Summit Solutions', 'Nexus Technologies', 'Bright Future Consulting',
    'Metro Marketing Group', 'Apex Innovations', 'Stellar Systems', 'Prime Enterprises',
    'Fusion Creative', 'Quantum Analytics', 'Phoenix Group'
  ];

  // Generate 150 income transactions
  const incomeTransactions = [];
  for (let i = 0; i < 150; i++) {
    const category = randomFrom(CATS_IN);
    const daysAgo = Math.floor(Math.random() * 365);
    const amount = randomAmount(500, 8000);
    
    incomeTransactions.push({
      id: generateId('tx'),
      name: descriptions[category]?.[Math.floor(Math.random() * descriptions[category].length)] || 'Service provided',
      amount,
      category,
      date: randomDate(daysAgo),
      type: 'income' as const,
      notes: ''
    });
  }

  // Generate 180 expense transactions
  const expenseTransactions = [];
  for (let i = 0; i < 180; i++) {
    const category = randomFrom(CATS_OUT);
    const daysAgo = Math.floor(Math.random() * 365);
    let amount;
    
    if (category === 'Rent / Workspace') amount = randomAmount(1500, 3000);
    else if (category === 'Equipment') amount = randomAmount(300, 2500);
    else if (category === 'Insurance') amount = randomAmount(200, 800);
    else if (category === 'Software / SaaS') amount = randomAmount(15, 150);
    else if (category === 'Travel') amount = randomAmount(100, 1200);
    else if (category === 'Advertising / Marketing') amount = randomAmount(50, 1500);
    else amount = randomAmount(20, 500);
    
    expenseTransactions.push({
      id: generateId('tx'),
      name: descriptions[category]?.[Math.floor(Math.random() * descriptions[category].length)] || 'Business expense',
      amount,
      category,
      date: randomDate(daysAgo),
      type: 'expense' as const,
      notes: ''
    });
  }

  // Add recurring monthly expenses (12 months)
  const recurringExpenses = [
    { category: 'Rent / Workspace', amount: 2200, name: 'Office rent' },
    { category: 'Phone / Internet', amount: 149, name: 'Comcast Business' },
    { category: 'Software / SaaS', amount: 54.99, name: 'Adobe Creative Cloud' },
    { category: 'Software / SaaS', amount: 12.99, name: 'Microsoft 365' },
    { category: 'Insurance', amount: 385, name: 'Business insurance' }
  ];

  for (let month = 0; month < 12; month++) {
    recurringExpenses.forEach(expense => {
      expenseTransactions.push({
        id: generateId('tx'),
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        date: randomDate(month * 30 + Math.floor(Math.random() * 5)),
        type: 'expense' as const,
        notes: 'Recurring monthly expense'
      });
    });
  }

  // Generate 80 invoices
  const invoices = [];
  for (let i = 0; i < 80; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const client = randomFrom(clients);
    const amount = randomAmount(1500, 15000);
    const dateIssued = randomDate(daysAgo);
    const dueDaysLater = 30 + Math.floor(Math.random() * 30);
    const dueDate = randomDate(daysAgo - dueDaysLater);
    
    let status: 'paid' | 'unpaid' | 'void';
    const rand = Math.random();
    if (daysAgo > 60) {
      status = rand < 0.8 ? 'paid' : (rand < 0.9 ? 'unpaid' : 'void');
    } else if (daysAgo > 30) {
      status = rand < 0.6 ? 'paid' : (rand < 0.85 ? 'unpaid' : 'void');
    } else {
      status = rand < 0.3 ? 'paid' : (rand < 0.95 ? 'unpaid' : 'void');
    }
    
    invoices.push({
      id: generateId('inv'),
      client,
      clientCompany: client,
      clientEmail: `contact@${client.toLowerCase().replace(/\s+/g, '')}.com`,
      clientAddress: `${Math.floor(Math.random() * 9000 + 1000)} Business Blvd, Suite ${Math.floor(Math.random() * 500)}`,
      amount,
      category: randomFrom(CATS_BILLING),
      description: randomFrom(['Consulting services', 'Web development', 'Design and branding', 'Marketing campaign', 'Software implementation']),
      date: dateIssued,
      due: dueDate,
      status,
      items: [
        {
          id: generateId('item'),
          description: 'Professional services rendered',
          quantity: 1,
          rate: amount
        }
      ],
      subtotal: amount,
      notes: '',
      discount: 0,
      taxRate: 0,
      shipping: 0,
      recurring: Math.random() < 0.15
    });
  }

  // Add specific overdue invoices
  const overdueInvoices = [
    { client: 'Tech Giants LLC', amount: 8500, daysOverdue: 15 },
    { client: 'Startup Ventures', amount: 6200, daysOverdue: 7 },
    { client: 'Enterprise Solutions', amount: 12000, daysOverdue: 45 }
  ];

  overdueInvoices.forEach(overdue => {
    const issueDate = randomDate(overdue.daysOverdue + 45);
    const dueDate = randomDate(overdue.daysOverdue);
    
    invoices.push({
      id: generateId('inv'),
      client: overdue.client,
      clientCompany: overdue.client,
      clientEmail: `billing@${overdue.client.toLowerCase().replace(/\s+/g, '')}.com`,
      clientAddress: `${Math.floor(Math.random() * 9000 + 1000)} Corporate Dr`,
      amount: overdue.amount,
      category: 'Consulting / Freelance',
      description: 'Professional services rendered',
      date: issueDate,
      due: dueDate,
      status: 'unpaid' as const,
      items: [
        {
          id: generateId('item'),
          description: 'Professional services',
          quantity: 1,
          rate: overdue.amount
        }
      ],
      subtotal: overdue.amount,
      notes: `OVERDUE ${overdue.daysOverdue} days - requires immediate attention`,
      discount: 0,
      taxRate: 0,
      shipping: 0,
      recurring: false
    });
  });

  // Generate tax payments
  const taxPayments = [];
  const quarters = [
    { month: 0, label: 'Q4 2025' },
    { month: 3, label: 'Q1 2026' },
    { month: 6, label: 'Q2 2026' },
    { month: 9, label: 'Q3 2026' }
  ];

  quarters.forEach(quarter => {
    const amount = randomAmount(3000, 8000);
    taxPayments.push({
      id: generateId('tax'),
      amount,
      date: randomDate(365 - (quarter.month * 30)),
      type: 'Estimated' as const,
      note: `${quarter.label} estimated tax payment`
    });
  });

  taxPayments.push({
    id: generateId('tax'),
    amount: randomAmount(8000, 15000),
    date: randomDate(350),
    type: 'Annual' as const,
    note: '2025 annual tax payment'
  });

  for (let i = 0; i < 5; i++) {
    taxPayments.push({
      id: generateId('tax'),
      amount: randomAmount(500, 3000),
      date: randomDate(Math.floor(Math.random() * 365)),
      type: 'Other' as const,
      note: 'Additional tax payment'
    });
  }

  // Combine and sort transactions
  const allTransactions = [...incomeTransactions, ...expenseTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    settings: {
      businessName: "Acme Creative Studio",
      ownerName: "Alex Rivera",
      businessAddress: "123 Innovation Blvd, Tech City, CA 90210",
      businessEmail: "hello@acmecreative.com",
      businessPhone: "(555) 123-4567",
      businessWebsite: "www.acmecreative.com",
      payPrefs: DEFAULT_PAY_PREFS,
      taxRate: 15,
      stateTaxRate: 5,
      taxEstimationMethod: 'custom' as const,
      filingStatus: 'single' as const,
      currencySymbol: "$",
      defaultInvoiceTerms: "Net 15. Please make checks payable to Acme Creative Studio.",
      defaultInvoiceNotes: "Thank you for your business!"
    },
    transactions: allTransactions,
    invoices: invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    taxPayments: taxPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  };
};
