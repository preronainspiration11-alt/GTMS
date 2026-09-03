// Canonical patrol route, department list and observation categories.
// The production shop floor is segregated into individual work areas.
const ROUTE = [
  ["MG","Main Gate","Security"],
  ["TWP","Two-Wheeler Parking Area","Admin"],
  ["MGP","Magpet","Maintenance"],
  ["UDA","Unloading Dock Area","Stores & Logistics"],
  ["PL","Parking Lot","Admin"],
  ["MTG","Material Gate","Security"],
  ["WB","Weighbridge","Stores & Logistics"],
  ["CPO","CPO","Production"],
  ["WRS","Warehouse Rear Side","Stores & Logistics"],
  ["RMT","RM Tank Farm","Production"],
  ["IPA","IPA / PESO","Safety & EHS"],
  ["ETP","ETP / STP","Safety & EHS"],
  ["SCY","Scrap Yard","Stores & Logistics"],
  ["BLR","Boiler House","Utility & Maintenance"],
  ["FWT","Fire Water Tank","Fire & Safety"],
  ["UTL","Utility","Utility & Maintenance"],
  ["PMP","Pump House","Utility & Maintenance"],
  ["ELR","Electrical Rooms","Electrical"],
  ["DGA","DG Area","Electrical"],
  ["ADM","Admin","Admin"],
  // ---- Shop floor (segregated) ----
  ["HCP","Home Care Packaging","Production"],
  ["CLP","CLS Packaging","Production"],
  ["QLB","Quality Lab","Quality"],
  ["TRA","Transformation Area","Production"],
  ["CMB","Combo Area","Production"],
  ["WH","Warehouse","Stores & Logistics"],
  ["WHD","Warehouse Dock","Stores & Logistics"],
  ["DSP","Dispensing Area","Production"],
  ["GBP","GBB Packaging","Production"],
  ["GBM","GBB Manufacturing","Production"],
  ["PCM","Personal Care Manufacturing","Production"],
  ["HCM","HC Manufacturing","Production"],
  ["MST","Maintenance Store","Maintenance"],
  // ---- Close-out ----
  ["ODA","Other Designated Areas","Security"],
  ["SCR","Security Control Room / Main Gate","Security"],
].map(([code, name, dept], i) => ({ seq: i + 1, code, name, dept }));

const DEPARTMENTS = [
  "Security","Admin","Maintenance","Stores & Logistics","Production",
  "Safety & EHS","Fire & Safety","Utility & Maintenance","Electrical","Quality",
];

const CATEGORIES = [
  ["Safety hazard","Safety & EHS"],
  ["Housekeeping","Admin"],
  ["Security breach","Security"],
  ["Equipment / Maintenance","Utility & Maintenance"],
  ["Fire safety","Fire & Safety"],
  ["Electrical fault","Electrical"],
  ["Spillage / Environment","Safety & EHS"],
  ["Quality issue","Quality"],
  ["Other", null],
];

module.exports = { ROUTE, DEPARTMENTS, CATEGORIES };
