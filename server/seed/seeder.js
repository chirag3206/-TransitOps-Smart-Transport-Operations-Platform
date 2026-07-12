#!/usr/bin/env node
/**
 * TransitOps — Database Seeder
 *
 * Usage:
 *   node seed/seeder.js            # Seed all collections (skips existing admin)
 *   node seed/seeder.js --fresh    # Drop all data first, then seed
 *   node seed/seeder.js --destroy  # Drop all data (no seed)
 *
 * Seeds:
 *   - 5 Users  (1 admin fleet_manager, 1 fleet_manager, 2 drivers, 1 safety_officer)
 *   - 10 Vehicles (trucks, vans, mini-trucks, buses)
 *   - 8 Drivers   (varied safety scores, license expiries)
 *   - 45 Trips    (spanning 12 months — Draft, Dispatched, Completed, Cancelled)
 *   - 12 Maintenance records (Closed + 1 Active)
 *   - 30 FuelLogs  (spread across months)
 *   - 25 Expenses  (all 6 categories)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User        = require('../models/User');
const Vehicle     = require('../models/Vehicle');
const Driver      = require('../models/Driver');
const Trip        = require('../models/Trip');
const Maintenance = require('../models/Maintenance');
const FuelLog     = require('../models/FuelLog');
const Expense     = require('../models/Expense');

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────
const daysAgo  = (n) => new Date(Date.now() - n * 86400_000);
const daysFrom = (n) => new Date(Date.now() + n * 86400_000);
const rand     = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick     = (arr) => arr[rand(0, arr.length - 1)];

// ────────────────────────────────────────────────────
// Seed Data Definitions
// ────────────────────────────────────────────────────

const USERS_DATA = [
  {
    name: 'Admin Manager',
    email: 'admin@transitops.com',
    password: 'Admin1234',
    role: 'fleet_manager',
  },
  {
    name: 'Rahul Sharma',
    email: 'rahul@transitops.com',
    password: 'Manager1234',
    role: 'fleet_manager',
  },
  {
    name: 'Alex Driver',
    email: 'alex@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
  {
    name: 'Priya Patel',
    email: 'priya@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
  {
    name: 'Safety Inspector',
    email: 'safety@transitops.com',
    password: 'Safety1234',
    role: 'safety_officer',
  },
  {
    name: 'Ravi Kumar',
    email: 'ravi@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
  {
    name: 'Sunita Singh',
    email: 'sunita@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
  {
    name: 'Manoj Verma',
    email: 'manoj@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
  {
    name: 'Anjali Sharma',
    email: 'anjali@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
  {
    name: 'Amit Patel',
    email: 'amit@transitops.com',
    password: 'Driver1234',
    role: 'driver',
  },
];

const VEHICLES_DATA = [
  {
    registrationNumber: 'DL-01-AB-1234',
    name: 'Tata Prima 4930.S',
    type: 'Truck',
    make: 'Tata',
    model: 'Prima 4930.S',
    year: 2022,
    fuelType: 'Diesel',
    maxLoadCapacity: 15000,
    acquisitionCost: 3200000,
    status: 'Available',
    odometer: 45230,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'DL-02-CD-5678',
    name: 'Ashok Leyland Captain 4940',
    type: 'Truck',
    make: 'Ashok Leyland',
    model: 'Captain 4940',
    year: 2021,
    fuelType: 'Diesel',
    maxLoadCapacity: 12000,
    acquisitionCost: 2800000,
    status: 'Available',
    odometer: 72100,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'MH-12-EF-9012',
    name: 'Mahindra Blazo X 28',
    type: 'Truck',
    make: 'Mahindra',
    model: 'Blazo X 28',
    year: 2023,
    fuelType: 'Diesel',
    maxLoadCapacity: 4500,
    acquisitionCost: 1600000,
    status: 'Available',
    odometer: 18900,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'GJ-01-GH-3456',
    name: 'Tata Ace Gold',
    type: 'Van',
    make: 'Tata',
    model: 'Ace Gold',
    year: 2022,
    fuelType: 'Diesel',
    maxLoadCapacity: 750,
    acquisitionCost: 550000,
    status: 'Available',
    odometer: 33400,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'RJ-14-IJ-7890',
    name: 'Force Traveller',
    type: 'Van',
    make: 'Force',
    model: 'Traveller',
    year: 2021,
    fuelType: 'Diesel',
    maxLoadCapacity: 500,
    acquisitionCost: 480000,
    status: 'Available',
    odometer: 28600,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'UP-16-KL-2345',
    name: 'Eicher Pro 3015',
    type: 'Truck',
    make: 'Eicher',
    model: 'Pro 3015',
    year: 2023,
    fuelType: 'Diesel',
    maxLoadCapacity: 3000,
    acquisitionCost: 1400000,
    status: 'Available',
    odometer: 11200,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'HR-26-MN-6789',
    name: 'Volvo FH 520',
    type: 'Truck',
    make: 'Volvo',
    model: 'FH 520',
    year: 2020,
    fuelType: 'Diesel',
    maxLoadCapacity: 20000,
    acquisitionCost: 8500000,
    status: 'Available',
    odometer: 138000,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'KA-03-OP-1357',
    name: 'Tata Winger Cargo',
    type: 'Van',
    make: 'Tata',
    model: 'Winger',
    year: 2022,
    fuelType: 'Diesel',
    maxLoadCapacity: 600,
    acquisitionCost: 520000,
    status: 'Available',
    odometer: 42000,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'TN-01-QR-2468',
    name: 'BharatBenz 1617R',
    type: 'Truck',
    make: 'BharatBenz',
    model: '1617R',
    year: 2021,
    fuelType: 'Diesel',
    maxLoadCapacity: 5000,
    acquisitionCost: 1900000,
    status: 'Available',
    odometer: 61500,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'WB-02-ST-9753',
    name: 'Tata LPS 4018',
    type: 'Truck',
    make: 'Tata',
    model: 'LPS 4018',
    year: 2019,
    fuelType: 'Diesel',
    maxLoadCapacity: 18000,
    acquisitionCost: 2900000,
    status: 'Available',
    odometer: 198000,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'MH-43-XY-1111',
    name: 'BharatBenz 2823JT Tanker',
    type: 'Tanker',
    make: 'BharatBenz',
    model: '2823JT',
    year: 2022,
    fuelType: 'Diesel',
    maxLoadCapacity: 16000,
    acquisitionCost: 3500000,
    status: 'Available',
    odometer: 12500,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'HR-55-AB-2222',
    name: 'Ashok Leyland U-4019 Flatbed',
    type: 'Flatbed',
    make: 'Ashok Leyland',
    model: 'U-4019',
    year: 2021,
    fuelType: 'Diesel',
    maxLoadCapacity: 22000,
    acquisitionCost: 4100000,
    status: 'Available',
    odometer: 54000,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'KA-51-CD-3333',
    name: 'Tata Ultra 1918.T Reefer',
    type: 'Refrigerated',
    make: 'Tata',
    model: 'Ultra 1918.T',
    year: 2023,
    fuelType: 'Diesel',
    maxLoadCapacity: 10000,
    acquisitionCost: 3100000,
    status: 'Available',
    odometer: 8900,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
  {
    registrationNumber: 'DL-03-EF-4444',
    name: 'Tata Yodha Pickup',
    type: 'Pickup',
    make: 'Tata',
    model: 'Yodha',
    year: 2022,
    fuelType: 'Diesel',
    maxLoadCapacity: 1700,
    acquisitionCost: 850000,
    status: 'Available',
    odometer: 15300,
    totalFuelCost: 0, totalMaintenanceCost: 0, totalRevenue: 0, totalTrips: 0,
  },
];

const DRIVERS_DATA = [
  {
    name: 'Alex Driver',
    contactNumber: '9876543210',
    email: 'alex@transitops.com',
    licenseNumber: 'DL-2019-1234567',
    licenseExpiryDate: daysFrom(180),
    licenseCategory: 'HMV',
    safetyScore: 92,
    status: 'Available',
    address: '12 Main Street, Delhi',
  },
  {
    name: 'Priya Patel',
    contactNumber: '9876543211',
    email: 'priya@transitops.com',
    licenseNumber: 'GJ-2020-7654321',
    licenseExpiryDate: daysFrom(300),
    licenseCategory: 'HMV',
    safetyScore: 87,
    status: 'Available',
    address: '34 Park Road, Ahmedabad',
  },
  {
    name: 'Ravi Kumar',
    contactNumber: '9876543212',
    email: 'ravi@transitops.com',
    licenseNumber: 'UP-2018-2345678',
    licenseExpiryDate: daysFrom(25), // expiring soon — triggers license alert
    licenseCategory: 'HMV',
    safetyScore: 78,
    status: 'Available',
    address: '56 Gandhi Nagar, Lucknow',
  },
  {
    name: 'Sunita Singh',
    contactNumber: '9876543213',
    email: 'sunita@transitops.com',
    licenseNumber: 'RJ-2021-3456789',
    licenseExpiryDate: daysFrom(200),
    licenseCategory: 'LMV',
    safetyScore: 95,
    status: 'Available',
    address: '78 Nehru Colony, Jaipur',
  },
  {
    name: 'Manoj Verma',
    contactNumber: '9876543214',
    email: 'manoj@transitops.com',
    licenseNumber: 'HR-2017-4567890',
    licenseExpiryDate: daysFrom(20), // also expiring soon
    licenseCategory: 'HMV',
    safetyScore: 65,
    status: 'Available',
    address: '90 Industrial Area, Gurgaon',
  },
  {
    name: 'Anjali Sharma',
    contactNumber: '9876543215',
    email: 'anjali@transitops.com',
    licenseNumber: 'KA-2022-5678901',
    licenseExpiryDate: daysFrom(400),
    licenseCategory: 'LMV',
    safetyScore: 98,
    status: 'Available',
    address: '23 MG Road, Bangalore',
  },
  {
    name: 'Vijay Nair',
    contactNumber: '9876543216',
    email: 'vijay@transitops.com',
    licenseNumber: 'TN-2019-6789012',
    licenseExpiryDate: daysFrom(150),
    licenseCategory: 'HMV',
    safetyScore: 82,
    status: 'Available',
    address: '67 Anna Salai, Chennai',
  },
  {
    name: 'Kiran Das',
    contactNumber: '9876543217',
    email: 'kiran@transitops.com',
    licenseNumber: 'WB-2020-7890123',
    licenseExpiryDate: daysFrom(365),
    licenseCategory: 'HMV',
    safetyScore: 74,
    status: 'Available',
    address: '45 Park Street, Kolkata',
  },
  {
    name: 'Amit Patel',
    contactNumber: '9876543218',
    email: 'amit@transitops.com',
    licenseNumber: 'GJ-2021-9876543',
    licenseExpiryDate: daysFrom(240),
    licenseCategory: 'LMV',
    safetyScore: 90,
    status: 'Available',
    address: '89 Satellite Road, Ahmedabad',
  },
];



// ────────────────────────────────────────────────────
// Database Connection
// ────────────────────────────────────────────────────
const connectDB = require('../config/db');

// ────────────────────────────────────────────────────
// Destroy — wipe all collections
// ────────────────────────────────────────────────────
const destroyData = async () => {
  await Promise.all([
    User.deleteMany({}),
    Vehicle.deleteMany({}),
    Driver.deleteMany({}),
    Trip.deleteMany({}),
    Maintenance.deleteMany({}),
    FuelLog.deleteMany({}),
    Expense.deleteMany({}),
  ]);
  console.log('🗑️   All data destroyed');
};

// ────────────────────────────────────────────────────
// Seed
// ────────────────────────────────────────────────────
const seedData = async () => {
  // ── Users ────────────────────────────────────────
  console.log('\n🌱  Seeding Users...');
  const userMap = {};
  for (const u of USERS_DATA) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`   ↳ Skipped (exists): ${u.email}`);
      userMap[u.email] = existing;
      continue;
    }
    const user = await User.create({ ...u, isVerified: true });
    userMap[u.email] = user;
    console.log(`   ✓ ${u.role.padEnd(15)} ${u.email}`);
  }
  const adminUser = userMap['admin@transitops.com'];

  // ── Vehicles ─────────────────────────────────────
  console.log('\n🌱  Seeding Vehicles...');
  const vehicles = [];
  for (const v of VEHICLES_DATA) {
    const existing = await Vehicle.findOne({ registrationNumber: v.registrationNumber });
    if (existing) {
      vehicles.push(existing);
      console.log(`   ↳ Skipped (exists): ${v.registrationNumber}`);
      continue;
    }
    const vehicle = await Vehicle.create(v);
    vehicles.push(vehicle);
    console.log(`   ✓ ${v.type.padEnd(15)} ${v.registrationNumber} — ${v.name}`);
  }

  // ── Drivers ──────────────────────────────────────
  console.log('\n🌱  Seeding Drivers...');
  const drivers = [];
  for (const d of DRIVERS_DATA) {
    const existing = await Driver.findOne({ licenseNumber: d.licenseNumber });
    if (existing) {
      drivers.push(existing);
      console.log(`   ↳ Skipped (exists): ${d.name}`);
      continue;
    }
    const driver = await Driver.create(d);
    drivers.push(driver);
    const expDays = Math.round((d.licenseExpiryDate - Date.now()) / 86400_000);
    console.log(`   ✓ ${d.name.padEnd(18)} score=${d.safetyScore} expires_in=${expDays}d`);
  }

  // ── Historical Trips (12 months of data) ─────────
  console.log('\n🌱  Seeding Trips (historical — 12 months)...');

  const ROUTES = [
    { source: 'Delhi', destination: 'Mumbai',    distance: 1421, baseRevenue: 42000 },
    { source: 'Mumbai', destination: 'Pune',     distance: 149,  baseRevenue: 6500  },
    { source: 'Delhi', destination: 'Jaipur',    distance: 281,  baseRevenue: 9000  },
    { source: 'Bangalore', destination: 'Chennai', distance: 347, baseRevenue: 11000 },
    { source: 'Delhi', destination: 'Agra',      distance: 204,  baseRevenue: 7200  },
    { source: 'Mumbai', destination: 'Ahmedabad', distance: 524, baseRevenue: 16000 },
    { source: 'Delhi', destination: 'Chandigarh', distance: 248, baseRevenue: 8000  },
    { source: 'Hyderabad', destination: 'Bangalore', distance: 570, baseRevenue: 18000 },
    { source: 'Chennai', destination: 'Kolkata', distance: 1668, baseRevenue: 52000 },
    { source: 'Delhi', destination: 'Lucknow',   distance: 555,  baseRevenue: 17000 },
  ];

  const createdTrips = [];

  // Create 40 completed historical trips over 12 months
  for (let i = 0; i < 40; i++) {
    const route = ROUTES[i % ROUTES.length];
    const vehicle = vehicles[i % vehicles.length];
    const driver  = drivers[i % drivers.length];
    const daysBack = rand(5, 360); // spread over 12 months
    const startDate = daysAgo(daysBack);
    const endDate   = new Date(startDate.getTime() + rand(1, 5) * 86400_000);
    const startOdo  = vehicle.odometer + rand(100, 5000);
    const endOdo    = startOdo + route.distance + rand(-20, 50);
    const fuelUsed  = Math.round(route.distance / rand(5, 9)); // 5–9 km/L
    const revenue   = Math.round(route.baseRevenue * (0.85 + Math.random() * 0.3));
    const cargo     = Math.round(vehicle.maxLoadCapacity * (0.3 + Math.random() * 0.6));

    const trip = await Trip.create({
      vehicle:          vehicle._id,
      driver:           driver._id,
      source:           route.source,
      destination:      route.destination,
      plannedDistance:  route.distance,
      cargoWeight:      Math.min(cargo, vehicle.maxLoadCapacity - 50),
      status:           'Completed',
      startOdometer:    startOdo,
      endOdometer:      endOdo,
      computedDistance: route.distance,
      fuelConsumed:     fuelUsed,
      fuelEfficiency:   parseFloat((route.distance / fuelUsed).toFixed(2)),
      revenue,
      dispatchedAt:  startDate,
      completedAt:   endDate,
      createdAt:     startDate,
      updatedAt:     endDate,
    });
    createdTrips.push(trip);

    if (i % 10 === 0) console.log(`   ✓ ${i + 1}/40 completed trips seeded`);
  }

  // 4 cancelled trips
  for (let i = 0; i < 4; i++) {
    const route = ROUTES[i];
    const vehicle = vehicles[i + 4];
    const driver  = drivers[i + 4];
    await Trip.create({
      vehicle: vehicle._id, driver: driver._id,
      source: route.source, destination: route.destination,
      plannedDistance: route.distance, cargoWeight: 500,
      status: 'Cancelled',
      cancellationReason: pick(['Client cancelled shipment', 'Route blocked by weather', 'Vehicle breakdown before dispatch', 'Driver emergency']),
      createdAt: daysAgo(rand(10, 90)),
    });
  }

  // 2 active (dispatched) trips
  for (let i = 0; i < 2; i++) {
    const route = ROUTES[i + 6];
    const vehicle = vehicles[i + 6];
    const driver  = drivers[i + 6];
    const startOdo = vehicle.odometer + 100;
    await Trip.create({
      vehicle: vehicle._id, driver: driver._id,
      source: route.source, destination: route.destination,
      plannedDistance: route.distance, cargoWeight: rand(500, 2000),
      status: 'Dispatched',
      startOdometer: startOdo,
      dispatchedAt: daysAgo(rand(1, 2)),
      createdAt: daysAgo(3),
    });
    // Mark vehicle + driver as On Trip
    await Vehicle.findByIdAndUpdate(vehicle._id, { status: 'On Trip' });
    await Driver.findByIdAndUpdate(driver._id, { status: 'On Trip' });
  }

  // 2 draft trips
  for (let i = 0; i < 2; i++) {
    const route = ROUTES[i + 3];
    const vehicle = vehicles[i + 8];
    const driver  = drivers[i];
    await Trip.create({
      vehicle: vehicle._id, driver: driver._id,
      source: route.source, destination: route.destination,
      plannedDistance: route.distance, cargoWeight: 300,
      status: 'Draft',
      createdAt: daysAgo(rand(1, 3)),
    });
  }

  console.log(`   ✓ 40 completed + 4 cancelled + 2 dispatched + 2 draft = 48 trips total`);

  // ── Maintenance Records ───────────────────────────
  console.log('\n🌱  Seeding Maintenance Records...');

  const MAINT_TYPES = [
    'Oil Change', 'Tire Replacement', 'Brake Service',
    'Engine Repair', 'Annual Inspection', 'Electrical Repair', 'Battery Replacement',
  ];

  // 12 closed records spread over 12 months
  for (let i = 0; i < 12; i++) {
    const vehicle = vehicles[i % vehicles.length];
    const daysBack = rand(10, 340);
    const startDate = daysAgo(daysBack);
    const endDate   = new Date(startDate.getTime() + rand(1, 7) * 86400_000);
    const estimated = rand(3000, 25000);
    const actual    = Math.round(estimated * (0.8 + Math.random() * 0.4));

    await Maintenance.create({
      vehicle:        vehicle._id,
      type:           MAINT_TYPES[i % MAINT_TYPES.length],
      description:    `Scheduled ${MAINT_TYPES[i % MAINT_TYPES.length]} for ${vehicle.registrationNumber}`,
      status:         'Closed',
      estimatedCost:  estimated,
      actualCost:     actual,
      workshopName:   pick(['AutoFix Delhi', 'Mumbai Motors', 'Tata Authorised Service', 'Royal Garage', 'National Workshop']),
      odometerReading: vehicle.odometer + rand(0, 5000),
      startDate,
      endDate,
      closedAt: endDate,
      closedBy: adminUser._id,
      createdAt: startDate,
    });
  }

  // 1 active maintenance (vehicle → In Shop)
  const inShopVehicle = vehicles[3]; // Ahmedabad Van
  await Maintenance.create({
    vehicle:       inShopVehicle._id,
    type:          'Engine Repair',
    description:   'Engine oil leak detected — requires full inspection and gasket replacement',
    status:        'In Workshop',
    estimatedCost: 18000,
    workshopName:  'Tata Authorised Service Centre',
    odometerReading: inShopVehicle.odometer,
    startDate:     daysAgo(2),
    createdAt:     daysAgo(2),
  });
  await Vehicle.findByIdAndUpdate(inShopVehicle._id, { status: 'In Shop' });
  console.log(`   ✓ 12 closed maintenance records + 1 active (${inShopVehicle.registrationNumber} In Shop)`);

  // ── Fuel Logs ─────────────────────────────────────
  console.log('\n🌱  Seeding Fuel Logs...');
  const FUEL_LOCATIONS = [
    'HP Pump — NH48', 'Indian Oil — Mathura Road', 'BPCL — Mumbai Highway',
    'Reliance Petroleum — Jaipur', 'HPCL — Bangalore', 'Shell — Chennai NH45',
    'Essar Petroleum — Kolkata', 'NRL — Delhi Gate',
  ];

  let totalFuelLogged = 0;
  for (let i = 0; i < 30; i++) {
    const vehicle = vehicles[i % vehicles.length];
    const daysBack = rand(2, 350);
    const logDate  = daysAgo(daysBack);
    const liters   = rand(40, 300);
    const price    = rand(88, 97); // INR per liter
    const total    = parseFloat((liters * price).toFixed(2));

    await FuelLog.create({
      vehicle:       vehicle._id,
      liters,
      pricePerLiter: price,
      totalCost:     total,
      date:          logDate, // proper Date object
      fuelType:      'Diesel',
      location:      pick(FUEL_LOCATIONS),
      odometerReading: vehicle.odometer + rand(100, 10000),
      loggedBy:      adminUser._id,
      createdAt:     logDate,
    });
    totalFuelLogged += total;
  }
  console.log(`   ✓ 30 fuel logs | Total cost: ₹${totalFuelLogged.toLocaleString('en-IN')}`);

  // ── Expenses ──────────────────────────────────────
  console.log('\n🌱  Seeding Expenses...');

  const EXPENSE_ENTRIES = [
    // Tolls
    ...Array.from({ length: 8 }, (_, i) => ({
      category: 'Toll',
      amount: rand(200, 1500),
      description: pick(['Delhi-Meerut Expressway Toll', 'Mumbai-Pune Expressway Toll', 'NH48 Toll Plaza', 'NH44 Toll Gate', 'Yamuna Expressway Toll']),
    })),
    // Parking
    ...Array.from({ length: 4 }, () => ({
      category: 'Parking',
      amount: rand(100, 800),
      description: pick(['Overnight parking — Delhi Depot', 'Warehouse parking — Mumbai', 'Truck terminal parking — Pune']),
    })),
    // Fine
    { category: 'Fine', amount: rand(500, 5000), description: 'Overloading penalty — Rajasthan border checkpoint' },
    { category: 'Fine', amount: rand(200, 1000), description: 'Speed violation fine — NH8' },
    // Insurance
    { category: 'Insurance', amount: rand(8000, 25000), description: 'Annual comprehensive insurance renewal' },
    { category: 'Insurance', amount: rand(3000, 8000), description: 'Third-party insurance premium' },
    // Tyre
    { category: 'Other', amount: rand(4000, 15000), description: 'Front axle tyre replacement — puncture damage' },
    { category: 'Other', amount: rand(2000, 6000), description: 'Tyre retreading — rear wheels' },
    // Other
    { category: 'Other', amount: rand(500, 3000), description: 'Driver allowance — overnight stay Pune' },
    { category: 'Other', amount: rand(1000, 5000), description: 'Loading/unloading labour charges' },
    { category: 'Other', amount: rand(300, 1500), description: 'Vehicle cleaning and sanitization' },
  ];

  let totalExpenses = 0;
  for (let i = 0; i < EXPENSE_ENTRIES.length; i++) {
    const entry = EXPENSE_ENTRIES[i];
    const vehicle = vehicles[i % vehicles.length];
    const daysBack = rand(1, 330);
    const expDate  = daysAgo(daysBack);

    await Expense.create({
      vehicle:     vehicle._id,
      category:    entry.category,
      amount:      entry.amount,
      description: entry.description,
      date:        expDate, // proper Date object
      loggedBy:    adminUser._id,
      createdAt:   expDate,
    });
    totalExpenses += entry.amount;
  }
  console.log(`   ✓ ${EXPENSE_ENTRIES.length} expenses | Total: ₹${totalExpenses.toLocaleString('en-IN')}`);

  // ── Update Vehicle Totals ─────────────────────────
  console.log('\n🔄  Updating vehicle financial totals...');
  for (const vehicle of vehicles) {
    const [fuelAgg, expAgg, maintAgg, tripAgg] = await Promise.all([
      FuelLog.aggregate([{ $match: { vehicle: vehicle._id } }, { $group: { _id: null, t: { $sum: '$totalCost' } } }]),
      Expense.aggregate([{ $match: { vehicle: vehicle._id } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
      Maintenance.aggregate([{ $match: { vehicle: vehicle._id, status: 'Closed' } }, { $group: { _id: null, t: { $sum: '$actualCost' } } }]),
      Trip.aggregate([{ $match: { vehicle: vehicle._id, status: 'Completed' } }, { $group: { _id: null, rev: { $sum: '$revenue' }, trips: { $sum: 1 } } }]),
    ]);

    await Vehicle.findByIdAndUpdate(vehicle._id, {
      totalFuelCost:        fuelAgg[0]?.t || 0,
      totalMaintenanceCost: maintAgg[0]?.t || 0,
      totalRevenue:         tripAgg[0]?.rev || 0,
      totalTrips:           tripAgg[0]?.trips || 0,
    });
  }
  console.log(`   ✓ All vehicle totals synchronized`);
};

// ────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────
const printSummary = async () => {
  const [users, vehicles, drivers, trips, maintenance, fuelLogs, expenses] = await Promise.all([
    User.countDocuments(),
    Vehicle.countDocuments(),
    Driver.countDocuments(),
    Trip.countDocuments(),
    Maintenance.countDocuments(),
    FuelLog.countDocuments(),
    Expense.countDocuments(),
  ]);

  const revenue = await Trip.aggregate([
    { $match: { status: 'Completed' } },
    { $group: { _id: null, total: { $sum: '$revenue' } } },
  ]);

  console.log('\n' + '═'.repeat(50));
  console.log('📊  TransitOps Database Summary');
  console.log('═'.repeat(50));
  console.log(`  👤 Users:       ${users}`);
  console.log(`  🚛 Vehicles:    ${vehicles}`);
  console.log(`  🧑‍✈️  Drivers:     ${drivers}`);
  console.log(`  🗺️  Trips:       ${trips} (includes ${await Trip.countDocuments({ status: 'Completed' })} completed)`);
  console.log(`  🔧 Maintenance: ${maintenance}`);
  console.log(`  ⛽ Fuel Logs:   ${fuelLogs}`);
  console.log(`  💸 Expenses:    ${expenses}`);
  console.log(`  💰 Total Revenue: ₹${(revenue[0]?.total || 0).toLocaleString('en-IN')}`);
  console.log('═'.repeat(50));
  console.log('\n✅  Seeding complete!\n');
  console.log('  Credentials:');
  console.log('  ┌────────────────────────────────────────┐');
  console.log('  │ Fleet Manager:  admin@transitops.com   │');
  console.log('  │ Password:       Admin1234              │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Fleet Manager:  rahul@transitops.com   │');
  console.log('  │ Password:       Manager1234            │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Safety Officer: safety@transitops.com  │');
  console.log('  │ Password:       Safety1234             │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Driver 1:       alex@transitops.com    │');
  console.log('  │ Password:       Driver1234             │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Driver 2:       priya@transitops.com   │');
  console.log('  │ Password:       Driver1234             │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Driver 3:       ravi@transitops.com    │');
  console.log('  │ Password:       Driver1234             │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Driver 4:       sunita@transitops.com  │');
  console.log('  │ Password:       Driver1234             │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Driver 5:       manoj@transitops.com   │');
  console.log('  │ Password:       Driver1234             │');
  console.log('  ├────────────────────────────────────────┤');
  console.log('  │ Driver 6:       anjali@transitops.com  │');
  console.log('  │ Password:       Driver1234             │');
  console.log('  └────────────────────────────────────────┘\n');
};

// ────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────
module.exports = { seedData, destroyData, printSummary };

if (require.main === module) {
  (async () => {
    try {
      await connectDB();

      const args = process.argv.slice(2);

      if (args.includes('--destroy')) {
        await destroyData();
        process.exit(0);
      }

      if (args.includes('--fresh')) {
        console.log('🗑️  --fresh flag: destroying existing data...');
        await destroyData();
      }

      await seedData();
      await printSummary();
      process.exit(0);
    } catch (err) {
      console.error('\n❌  Seeder failed:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  })();
}
