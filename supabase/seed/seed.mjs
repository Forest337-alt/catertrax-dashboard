/**
 * CaterTrax Demo Site #1 — Synthetic Data Seed
 * Run: node supabase/seed/seed.mjs
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (or env vars)
 * Or set SUPABASE_SERVICE_KEY for bypassing RLS.
 */

import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildSuggestedViews } from './suggestedViews.mjs'

// ─── Config ──────────────────────────────────────────────────────────────────

faker.seed(20240101) // deterministic

const __dir = dirname(fileURLToPath(import.meta.url))

// Load .env manually (no dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(__dir, '../../.env')
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env file, use existing env */ }
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Constants ────────────────────────────────────────────────────────────────

const SITE_NAME   = 'CaterTrax Demo Site #1'
const START_DATE  = new Date('2024-11-01')
const END_DATE    = new Date('2026-04-30')
const TARGET_ORDERS = 1800

const ORDER_TYPES   = ['drop_off','drop_off','drop_off','drop_off','drop_off','drop_off','drop_off','drop_off','drop_off','full_service','full_service','full_service','full_service','full_service','full_service','pickup','pickup','pickup','pickup','delivery','delivery','delivery']
const CHANNELS      = ['web_portal','web_portal','web_portal','web_portal','web_portal','web_portal','web_portal','web_portal','web_portal','web_portal','web_portal','mobile_app','mobile_app','mobile_app','mobile_app','mobile_app','phone_email','phone_email','phone_email','repeat_template','repeat_template']
const STATUSES      = ['completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','completed','cancelled','modified']
const ACCOUNT_TYPES = ['academic_dept','academic_dept','academic_dept','academic_dept','academic_dept','academic_dept','academic_dept','academic_dept','administrative','administrative','administrative','administrative','administrative','student_org','student_org','student_org','student_org','external','external','external']
const LIFECYCLE     = ['new','growing','growing','growing','established','established','established','established','established','established','at_risk','dormant']

const MENU_CATEGORIES = ['hot_entree','sandwich_platter','breakfast','salad_bowl','beverage','dessert_bakery','appetizer','boxed_meal']

const MENU_ITEMS_PER_CATEGORY = {
  hot_entree: 10,
  sandwich_platter: 10,
  breakfast: 8,
  salad_bowl: 8,
  beverage: 8,
  dessert_bakery: 7,
  appetizer: 7,
  boxed_meal: 6,
} // = 64 total

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(faker.number.float({ min: 0, max: 1 }) * arr.length)]
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000)
}

/** Seasonality multiplier (0.0–1.0) for a given date */
function seasonality(date) {
  const month = date.getMonth() + 1 // 1–12
  const dow = date.getDay()         // 0=Sun, 6=Sat

  // Summer dip Jun-Aug
  let base = 1.0
  if (month >= 6 && month <= 8)  base = 0.6
  if (month === 12)              base = 0.7
  if (month === 9 || month === 10) base = 1.1
  if (month === 3 || month === 4)  base = 1.15

  // Weekend dip
  if (dow === 0) base *= 0.2
  if (dow === 6) base *= 0.45

  return Math.min(base, 1.5)
}

function randomDate(start, end) {
  const totalDays = daysBetween(start, end)
  return addDays(start, Math.floor(faker.number.float({ min: 0, max: 1 }) * totalDays))
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

// ─── Generate menu items ───────────────────────────────────────────────────────

function generateMenuItems(siteId) {
  const items = []

  const names = {
    hot_entree: ['Herb Roasted Chicken','Beef Tenderloin','Salmon Piccata','Chicken Marsala','Pasta Primavera','Vegetable Stir Fry','BBQ Pulled Pork','Eggplant Parmesan','Chicken Tikka Masala','Beef Bourguignon'],
    sandwich_platter: ['Turkey & Swiss Platter','Italian Sub Platter','Veggie Wrap Platter','Club Sandwich Platter','Caprese Panini Platter','BLT Platter','Chicken Caesar Wrap Platter','Roast Beef Platter','Mediterranean Wrap Platter','Grilled Veggie Platter'],
    breakfast: ['Continental Breakfast Spread','Scrambled Eggs Station','Breakfast Burrito Platter','Yogurt Parfait Bar','Assorted Bagels & Lox','Pancake & Waffle Station','Frittata Platter','French Toast Station'],
    salad_bowl: ['Classic Caesar Salad','Garden Salad Bowl','Greek Salad Platter','Quinoa Power Bowl','Caprese Salad Platter','Kale & Grain Bowl','Asian Sesame Salad','Nicoise Salad Platter'],
    beverage: ['Coffee Service (Gallon)','Iced Tea Dispenser','Lemonade Dispenser','Sparkling Water Case','Juice Assortment','Hot Tea Service','Soda Package','Arnold Palmer Station'],
    dessert_bakery: ['Assorted Cookie Tray','Brownie Platter','Seasonal Fruit Tart','Cheesecake Bites','Mini Cupcake Assortment','Macarons Box','Cannoli Tray'],
    appetizer: ['Cheese & Charcuterie Board','Shrimp Cocktail Platter','Bruschetta Platter','Stuffed Mushrooms','Spring Roll Platter','Hummus & Crudité','Caprese Skewers'],
    boxed_meal: ['Classic Deli Box','Vegan Power Box','Chef Salad Box','Grilled Chicken Box','Mediterranean Box','Asian Noodle Box'],
  }

  const basePrices = {
    hot_entree: [14, 28],
    sandwich_platter: [12, 20],
    breakfast: [10, 22],
    salad_bowl: [9, 18],
    beverage: [15, 40],
    dessert_bakery: [18, 35],
    appetizer: [20, 45],
    boxed_meal: [11, 18],
  }

  for (const [category, count] of Object.entries(MENU_ITEMS_PER_CATEGORY)) {
    const categoryNames = names[category]
    const [minPrice, maxPrice] = basePrices[category]

    for (let i = 0; i < count; i++) {
      const basePrice = parseFloat((faker.number.float({ min: minPrice, max: maxPrice })).toFixed(2))
      const costPct = faker.number.float({ min: 0.25, max: 0.45 })
      const cost = parseFloat((basePrice * costPct).toFixed(2))
      const isVegan = category === 'salad_bowl' || category === 'beverage'
        ? faker.datatype.boolean({ probability: 0.4 })
        : faker.datatype.boolean({ probability: 0.1 })

      items.push({
        site_id: siteId,
        name: categoryNames[i] ?? `${faker.commerce.productName()} (${category})`,
        category,
        base_price: basePrice,
        cost,
        is_vegetarian: isVegan || faker.datatype.boolean({ probability: 0.25 }),
        is_vegan: isVegan,
        is_gluten_free: faker.datatype.boolean({ probability: 0.15 }),
        active: true,
      })
    }
  }

  return items
}

// ─── Generate accounts ────────────────────────────────────────────────────────

function generateAccounts(siteId, count = 84) {
  const deptPrefixes = ['College of','School of','Department of','Office of','Division of','Institute for','Center for','Program in']
  const deptSuffixes = ['Engineering','Arts & Sciences','Business','Medicine','Law','Education','Public Policy','Computer Science','Biology','Chemistry','History','Economics','Psychology','Sociology','Mathematics','Physics','English','Architecture','Music','Theater']
  const adminOffices = ['President\'s Office','Provost\'s Office','Human Resources','Facilities Management','Alumni Relations','Development Office','Communications','IT Services','Finance & Accounting','Student Affairs','Enrollment Management','Research Office','Compliance','General Counsel','Campus Operations']
  const studentOrgs = ['Student Government','International Student Association','Engineering Club','Business Society','Pre-Med Club','Environmental Club','Drama Society','Music Ensemble','Athletics Booster','Debate Team','Photography Club','Film Society','Community Service Network','Greek Life Council','Honor Society']
  const externals = ['Campus Bookstore','Athletics Department','Guest Services','Conference Center','Faculty Club','Executive Education','Continuing Education','Visiting Scholar Program','Board of Trustees','Donor Relations']

  const accounts = []

  for (let i = 0; i < count; i++) {
    const accountType = ACCOUNT_TYPES[i % ACCOUNT_TYPES.length]
    let name

    switch (accountType) {
      case 'academic_dept':
        name = `${pick(deptPrefixes)} ${pick(deptSuffixes)}`
        break
      case 'administrative':
        name = adminOffices[i % adminOffices.length]
        break
      case 'student_org':
        name = studentOrgs[i % studentOrgs.length]
        break
      default:
        name = externals[i % externals.length]
    }

    const createdAt = randomDate(new Date('2023-06-01'), START_DATE)
    const lifecycle = LIFECYCLE[Math.floor(faker.number.float({ min: 0, max: 1 }) * LIFECYCLE.length)]

    accounts.push({
      site_id: siteId,
      name: i < count - 1 ? name : `${name} ${Math.ceil(i / (deptSuffixes.length * deptPrefixes.length))}`, // deduplicate
      account_type: accountType,
      first_order_date: formatDate(createdAt),
      lifecycle_stage: lifecycle,
      created_at: createdAt.toISOString(),
    })
  }

  // Deduplicate names
  const seen = new Set()
  return accounts.map((a, i) => {
    let name = a.name
    let suffix = 1
    while (seen.has(name)) {
      name = `${a.name} ${suffix++}`
    }
    seen.add(name)
    return { ...a, name }
  })
}

// ─── Generate orders ──────────────────────────────────────────────────────────

function generateOrders(siteId, accounts, menuItems) {
  const orders = []
  const orderItems = []
  let orderNumber = 1000

  // Top accounts should generate ~35% of revenue — give them extra weight
  const accountWeights = accounts.map((_, i) => i < 10 ? 5 : 1)
  const totalWeight = accountWeights.reduce((a, b) => a + b, 0)

  function pickAccount() {
    const rand = faker.number.float({ min: 0, max: 1 }) * totalWeight
    let acc = 0
    for (let i = 0; i < accounts.length; i++) {
      acc += accountWeights[i]
      if (rand <= acc) return accounts[i]
    }
    return accounts[accounts.length - 1]
  }

  const totalDays = daysBetween(START_DATE, END_DATE)

  // Distribute orders across the date range using seasonality
  let attempts = 0
  const maxAttempts = TARGET_ORDERS * 10

  while (orders.length < TARGET_ORDERS && attempts < maxAttempts) {
    attempts++
    const eventDate = addDays(START_DATE, Math.floor(faker.number.float({ min: 0, max: 1 }) * totalDays))
    const season = seasonality(eventDate)

    // Probabilistically skip based on seasonality
    if (faker.number.float({ min: 0, max: 1 }) > season) continue

    const account = pickAccount()
    const status = pick(STATUSES)
    const orderType = pick(ORDER_TYPES)
    const channel = pick(CHANNELS)
    const guestCount = faker.number.int({ min: 5, max: 120 })

    // Order placed 1–14 days before event
    const orderDate = addDays(eventDate, -faker.number.int({ min: 1, max: 14 }))
    if (orderDate < START_DATE) continue

    // Event time based on order type
    let eventTimeHour = 12
    if (orderType === 'breakfast') eventTimeHour = faker.number.int({ min: 7, max: 10 })
    else if (eventDate.getDay() === 0 || eventDate.getDay() === 6) eventTimeHour = faker.number.int({ min: 10, max: 14 })
    else eventTimeHour = faker.number.int({ min: 11, max: 15 })

    const eventTime = `${String(eventTimeHour).padStart(2,'0')}:${pick(['00','15','30','45'])}:00`

    // Generate 1–6 line items
    const itemCount = faker.number.int({ min: 1, max: 6 })
    const selectedItems = faker.helpers.arrayElements(menuItems, itemCount)
    let subtotal = 0
    const lineItems = []

    for (const item of selectedItems) {
      const qty = faker.number.int({ min: 1, max: Math.ceil(guestCount / itemCount) })
      const unitPrice = parseFloat((item.base_price * faker.number.float({ min: 0.9, max: 1.1 })).toFixed(2))
      const lineTotal = parseFloat((qty * unitPrice).toFixed(2))
      subtotal += lineTotal

      lineItems.push({
        menu_item_id: item.id,
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal,
        dietary_modifications: faker.datatype.boolean({ probability: 0.2 })
          ? [pick(['no nuts','gluten free','dairy free','extra spicy','vegan'])]
          : [],
      })
    }

    subtotal = parseFloat(subtotal.toFixed(2))
    const addonsTotal = parseFloat((subtotal * faker.number.float({ min: 0, max: 0.08 })).toFixed(2))
    const total = parseFloat((subtotal + addonsTotal).toFixed(2))

    const fulfilledOnTime = status === 'completed'
      ? faker.datatype.boolean({ probability: 0.93 })
      : null

    orders.push({
      id: faker.string.uuid(),
      site_id: siteId,
      account_id: account.id,
      order_number: `ORD-${orderNumber++}`,
      order_date: formatDate(orderDate),
      event_date: formatDate(eventDate),
      event_time: eventTime,
      order_type: orderType,
      channel,
      status,
      guest_count: guestCount,
      subtotal,
      addons_total: addonsTotal,
      total,
      fulfilled_on_time: fulfilledOnTime,
    })

    for (const li of lineItems) {
      orderItems.push({ ...li, order_id: orders[orders.length - 1].id })
    }
  }

  return { orders, orderItems }
}

// ─── Generate budget ──────────────────────────────────────────────────────────

function generateBudget(siteId) {
  const records = []
  const cursor = new Date('2024-11-01')
  const end = new Date('2026-04-01')

  let baseRevenue = 85000

  while (cursor <= end) {
    const month = cursor.getMonth() + 1
    // Summer dip
    let multiplier = 1.0
    if (month >= 6 && month <= 8) multiplier = 0.65
    if (month === 12) multiplier = 0.75

    records.push({
      site_id: siteId,
      period_month: formatDate(cursor),
      budgeted_revenue: parseFloat((baseRevenue * multiplier).toFixed(2)),
      budgeted_food_cost_pct: parseFloat(faker.number.float({ min: 28, max: 34 }).toFixed(1)),
      budgeted_labor_pct: parseFloat(faker.number.float({ min: 22, max: 28 }).toFixed(1)),
    })

    // Slight upward trend
    baseRevenue *= 1.008
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return records
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed for CaterTrax Demo Site #1...\n')

  // ── 1. Site ──
  console.log('Creating site...')
  const { data: siteData, error: siteErr } = await sb
    .from('sites')
    .insert({
      name: SITE_NAME,
      location: 'Midland University, Midland, OH',
      site_type: 'higher_ed',
    })
    .select('id')
    .single()

  if (siteErr) {
    // If already exists, fetch it
    const { data: existing } = await sb.from('sites').select('id').eq('name', SITE_NAME).single()
    if (!existing) { console.error('Failed to create site:', siteErr.message); process.exit(1) }
    console.log('  Site already exists, using existing:', existing.id)
    siteData = existing
  }
  const siteId = siteData.id
  console.log(`  Site ID: ${siteId}\n`)

  // ── 2. Menu items ──
  console.log('Creating menu items...')
  const menuItemsRaw = generateMenuItems(siteId)
  const { data: menuData, error: menuErr } = await sb
    .from('menu_items')
    .insert(menuItemsRaw)
    .select('id, base_price, category')

  if (menuErr) { console.error('Menu items failed:', menuErr.message); process.exit(1) }
  console.log(`  Created ${menuData.length} menu items\n`)

  // ── 3. Accounts ──
  console.log('Creating accounts...')
  const accountsRaw = generateAccounts(siteId)
  const { data: accountData, error: accErr } = await sb
    .from('accounts')
    .insert(accountsRaw)
    .select('id, name, account_type')

  if (accErr) { console.error('Accounts failed:', accErr.message); process.exit(1) }
  console.log(`  Created ${accountData.length} accounts\n`)

  // ── 4. Orders + line items ──
  console.log('Generating orders...')
  const { orders, orderItems } = generateOrders(siteId, accountData, menuData)
  console.log(`  Generated ${orders.length} orders, ${orderItems.length} line items`)

  // Insert in batches of 200
  console.log('  Inserting orders...')
  const BATCH = 200
  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH)
    const { error } = await sb.from('orders').insert(batch)
    if (error) { console.error(`Orders batch ${i} failed:`, error.message); process.exit(1) }
    process.stdout.write(`\r  Orders: ${Math.min(i + BATCH, orders.length)}/${orders.length}`)
  }
  console.log()

  console.log('  Inserting order items...')
  for (let i = 0; i < orderItems.length; i += BATCH) {
    const batch = orderItems.slice(i, i + BATCH)
    const { error } = await sb.from('order_items').insert(batch)
    if (error) { console.error(`Line items batch ${i} failed:`, error.message); process.exit(1) }
    process.stdout.write(`\r  Line items: ${Math.min(i + BATCH, orderItems.length)}/${orderItems.length}`)
  }
  console.log('\n')

  // ── 5. Budget ──
  console.log('Creating budget records...')
  const budgetData = generateBudget(siteId)
  const { error: budgetErr } = await sb.from('budget').insert(budgetData)
  if (budgetErr) { console.error('Budget failed:', budgetErr.message); process.exit(1) }
  console.log(`  Created ${budgetData.length} monthly budget records\n`)

  // ── 6. Suggested views ──
  console.log('Creating suggested views...')
  await seedSuggestedViews(sb, siteId)

  console.log('\n✅ Seed complete!')
  console.log(`\n📋 Summary:`)
  console.log(`   Site ID:      ${siteId}`)
  console.log(`   Menu items:   ${menuData.length}`)
  console.log(`   Accounts:     ${accountData.length}`)
  console.log(`   Orders:       ${orders.length}`)
  console.log(`   Line items:   ${orderItems.length}`)
  console.log(`   Budget rows:  ${budgetData.length}`)
  console.log(`\n💡 Copy this site ID into your .env as VITE_DEMO_SITE_ID=${siteId}`)
}

async function seedSuggestedViews(sb, siteId) {
  await sb.from('saved_views').delete().eq('is_suggested', true)
  const { error } = await sb.from('saved_views').insert(buildSuggestedViews(siteId))
  if (error) throw error
  console.log('  ✓ 32 suggested views seeded')
}

// ─── Legacy inline views (replaced by suggestedViews.mjs) ─────────────────────
async function _unusedLegacySeedSuggestedViews(sb, siteId) {
  const views = [
    // ─── Orders & Revenue ─────────────────────────────────────────────────────
    {
      name: 'Monthly Revenue Trend',
      description: '[revenue] Completed-order revenue by month over the last 18 months.',
      sql_query: `SELECT DATE_TRUNC('month', event_date)::DATE AS month, SUM(total) AS revenue FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 18`,
      chart_spec: {
        title: 'Monthly Revenue Trend',
        description: 'Completed-order revenue by month over the last 18 months.',
        sql: `SELECT DATE_TRUNC('month', event_date)::DATE AS month, SUM(total) AS revenue FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 18`,
        chart_type: 'area',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
        series: [{ field: 'revenue', label: 'Revenue', color: '#1e40af' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
        drill_down_hint: 'Click a month to filter orders for that period',
      },
      is_suggested: true,
    },
    {
      name: 'Revenue vs Budget',
      description: '[revenue] Actual vs budgeted revenue by month.',
      sql_query: `SELECT b.period_month AS month, b.budgeted_revenue AS budget, COALESCE(SUM(o.total),0) AS actual FROM budget b LEFT JOIN orders o ON DATE_TRUNC('month', o.event_date) = b.period_month AND o.site_id = b.site_id AND o.status = 'completed' WHERE b.site_id = '${siteId}' GROUP BY b.period_month, b.budgeted_revenue ORDER BY 1 LIMIT 18`,
      chart_spec: {
        title: 'Revenue vs Budget',
        description: 'Actual completed-order revenue vs monthly budget targets.',
        sql: `SELECT b.period_month AS month, b.budgeted_revenue AS budget, COALESCE(SUM(o.total),0) AS actual FROM budget b LEFT JOIN orders o ON DATE_TRUNC('month', o.event_date) = b.period_month AND o.site_id = b.site_id AND o.status = 'completed' WHERE b.site_id = '${siteId}' GROUP BY b.period_month, b.budgeted_revenue ORDER BY 1 LIMIT 18`,
        chart_type: 'line',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'actual', label: 'Revenue ($)', type: 'currency' },
        series: [{ field: 'actual', label: 'Actual', color: '#1e40af' }, { field: 'budget', label: 'Budget', color: '#d97706' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },
    {
      name: 'Orders by Channel',
      description: '[revenue] Order count and revenue split by booking channel.',
      sql_query: `SELECT channel, COUNT(*) AS order_count, SUM(total) AS revenue FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY channel ORDER BY revenue DESC LIMIT 10`,
      chart_spec: {
        title: 'Orders by Channel',
        description: 'Order count and revenue split by booking channel.',
        sql: `SELECT channel, COUNT(*) AS order_count, SUM(total) AS revenue FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY channel ORDER BY revenue DESC LIMIT 10`,
        chart_type: 'bar',
        x_axis: { field: 'channel', label: 'Channel', type: 'categorical' },
        y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
        series: [{ field: 'revenue', label: 'Revenue', color: '#1e40af' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },

    // ─── Program Adoption ─────────────────────────────────────────────────────
    {
      name: 'Top 15 Accounts by Revenue',
      description: '[adoption] Revenue ranking of the top 15 ordering accounts.',
      sql_query: `SELECT a.name AS account, a.account_type, SUM(o.total) AS revenue, COUNT(o.id) AS orders FROM orders o JOIN accounts a ON a.id = o.account_id WHERE o.site_id = '${siteId}' AND o.status = 'completed' GROUP BY a.id, a.name, a.account_type ORDER BY revenue DESC LIMIT 15`,
      chart_spec: {
        title: 'Top 15 Accounts by Revenue',
        description: 'Revenue ranking of the top 15 ordering accounts.',
        sql: `SELECT a.name AS account, a.account_type, SUM(o.total) AS revenue, COUNT(o.id) AS orders FROM orders o JOIN accounts a ON a.id = o.account_id WHERE o.site_id = '${siteId}' AND o.status = 'completed' GROUP BY a.id, a.name, a.account_type ORDER BY revenue DESC LIMIT 15`,
        chart_type: 'bar',
        x_axis: { field: 'account', label: 'Account', type: 'categorical' },
        y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
        series: [{ field: 'revenue', label: 'Revenue', color: '#059669' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
        drill_down_hint: 'Click an account to see its order history',
      },
      is_suggested: true,
    },
    {
      name: 'Account Lifecycle Distribution',
      description: '[adoption] How accounts are distributed across lifecycle stages.',
      sql_query: `SELECT lifecycle_stage, COUNT(*) AS account_count FROM accounts WHERE site_id = '${siteId}' GROUP BY lifecycle_stage ORDER BY account_count DESC LIMIT 10`,
      chart_spec: {
        title: 'Account Lifecycle Distribution',
        description: 'How accounts are distributed across lifecycle stages.',
        sql: `SELECT lifecycle_stage, COUNT(*) AS account_count FROM accounts WHERE site_id = '${siteId}' GROUP BY lifecycle_stage ORDER BY account_count DESC LIMIT 10`,
        chart_type: 'pie',
        x_axis: { field: 'lifecycle_stage', label: 'Stage', type: 'categorical' },
        y_axis: { field: 'account_count', label: 'Accounts', type: 'numeric' },
        series: [{ field: 'account_count', label: 'Accounts', color: '#059669' }],
      },
      is_suggested: true,
    },
    {
      name: 'Order Volume by Day of Week',
      description: '[adoption] When orders happen across the week.',
      sql_query: `SELECT TO_CHAR(event_date, 'Dy') AS day, EXTRACT(DOW FROM event_date)::INT AS dow_num, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY day, dow_num ORDER BY dow_num LIMIT 7`,
      chart_spec: {
        title: 'Order Volume by Day of Week',
        description: 'Order count and revenue by day of week — reveals weekly demand patterns.',
        sql: `SELECT TO_CHAR(event_date, 'Dy') AS day, EXTRACT(DOW FROM event_date)::INT AS dow_num, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY day, dow_num ORDER BY dow_num LIMIT 7`,
        chart_type: 'bar',
        x_axis: { field: 'day', label: 'Day', type: 'categorical' },
        y_axis: { field: 'orders', label: 'Order Count', type: 'numeric' },
        series: [{ field: 'orders', label: 'Orders', color: '#7c3aed' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },

    // ─── Menu Mix ─────────────────────────────────────────────────────────────
    {
      name: 'Revenue by Menu Category',
      description: '[menu] Revenue contribution by menu category.',
      sql_query: `SELECT mi.category, SUM(oi.line_total) AS revenue, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE o.site_id = '${siteId}' AND o.status = 'completed' GROUP BY mi.category ORDER BY revenue DESC LIMIT 10`,
      chart_spec: {
        title: 'Revenue by Menu Category',
        description: 'Revenue contribution by menu category.',
        sql: `SELECT mi.category, SUM(oi.line_total) AS revenue, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE o.site_id = '${siteId}' AND o.status = 'completed' GROUP BY mi.category ORDER BY revenue DESC LIMIT 10`,
        chart_type: 'bar',
        x_axis: { field: 'category', label: 'Category', type: 'categorical' },
        y_axis: { field: 'revenue', label: 'Revenue ($)', type: 'currency' },
        series: [{ field: 'revenue', label: 'Revenue', color: '#d97706' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },
    {
      name: 'Top 10 Menu Items by Units Sold',
      description: '[menu] Most popular items by quantity ordered.',
      sql_query: `SELECT mi.name AS item, mi.category, SUM(oi.quantity) AS units_sold, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE o.site_id = '${siteId}' AND o.status = 'completed' GROUP BY mi.id, mi.name, mi.category ORDER BY units_sold DESC LIMIT 10`,
      chart_spec: {
        title: 'Top 10 Menu Items by Units Sold',
        description: 'Most popular items by quantity ordered.',
        sql: `SELECT mi.name AS item, mi.category, SUM(oi.quantity) AS units_sold, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE o.site_id = '${siteId}' AND o.status = 'completed' GROUP BY mi.id, mi.name, mi.category ORDER BY units_sold DESC LIMIT 10`,
        chart_type: 'bar',
        x_axis: { field: 'item', label: 'Menu Item', type: 'categorical' },
        y_axis: { field: 'units_sold', label: 'Units Sold', type: 'numeric' },
        series: [{ field: 'units_sold', label: 'Units Sold', color: '#d97706' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },

    // ─── Financials ───────────────────────────────────────────────────────────
    {
      name: 'Average Order Value Trend',
      description: '[financials] Average order value per month.',
      sql_query: `SELECT DATE_TRUNC('month', event_date)::DATE AS month, AVG(total) AS avg_order_value, COUNT(*) AS order_count FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 18`,
      chart_spec: {
        title: 'Average Order Value Trend',
        description: 'Average order value per month.',
        sql: `SELECT DATE_TRUNC('month', event_date)::DATE AS month, AVG(total) AS avg_order_value, COUNT(*) AS order_count FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 18`,
        chart_type: 'line',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'avg_order_value', label: 'Avg Order Value ($)', type: 'currency' },
        series: [{ field: 'avg_order_value', label: 'Avg Order Value', color: '#dc2626' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },
    {
      name: 'On-Time Fulfillment Rate',
      description: '[financials] Percentage of completed orders fulfilled on time by month.',
      sql_query: `SELECT DATE_TRUNC('month', event_date)::DATE AS month, ROUND(100.0 * SUM(CASE WHEN fulfilled_on_time THEN 1 ELSE 0 END) / COUNT(*), 1) AS on_time_pct, COUNT(*) AS total_orders FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 18`,
      chart_spec: {
        title: 'On-Time Fulfillment Rate',
        description: 'Percentage of completed orders fulfilled on time by month.',
        sql: `SELECT DATE_TRUNC('month', event_date)::DATE AS month, ROUND(100.0 * SUM(CASE WHEN fulfilled_on_time THEN 1 ELSE 0 END) / COUNT(*), 1) AS on_time_pct, COUNT(*) AS total_orders FROM orders WHERE site_id = '${siteId}' AND status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 18`,
        chart_type: 'line',
        x_axis: { field: 'month', label: 'Month', type: 'temporal' },
        y_axis: { field: 'on_time_pct', label: 'On-Time %', type: 'percent' },
        series: [{ field: 'on_time_pct', label: 'On-Time %', color: '#059669' }],
        filters_applied: [{ field: 'status', value: 'completed' }],
      },
      is_suggested: true,
    },
  ]

  const { error } = await sb.from('saved_views').insert(views)
  if (error) {
    console.error('  Suggested views failed:', error.message)
  } else {
    console.log(`  Created ${views.length} suggested views`)
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
