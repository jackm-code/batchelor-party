// The cost formula. Pure functions, no rounding: money is in USD cents as
// plain numbers and is only rounded when shown (see format.ts).
//
// Flights are never part of this.

export interface CostInputs {
  roomRate: number;        // cents per room per night, before tax
  taxPct: number;          // hotel tax, percent
  nightlyFee: number;      // cents per room per night, flat
  bedsPerRoom: number;
  dailySpend: number;      // cents per person per day
  activities: number;      // cents per person, whole trip
  transferFare: number;    // cents per person, one way (NYC to Boston)
  localsNeedBed: boolean;  // do Boston-based guests need a bed in this city?
  visitorLegs: number;     // transfer legs for a visiting guest (and the groom)
  localLegs: number;       // transfer legs for a Boston-based guest
}

export interface Scenario {
  nights: number;
  groupSize: number;       // everyone, including the groom
  localGuests: number;     // Boston-based guests
  groomCovered: boolean;   // the group pays the groom's share
}

export interface CostResult {
  groupSize: number;
  locals: number;
  visitors: number;        // visiting guests, not counting the groom
  bedsNeeded: number;
  rooms: number;
  roomNightCost: number;   // one room, one night, with tax and fee
  stayTotal: number;       // all rooms, all nights
  stayPerBed: number;
  dailyTotal: number;      // daily spend x nights
  visitorTransfer: number;
  localTransfer: number;
  visitorOwn: number;      // a visiting guest's own costs
  localOwn: number;
  groomOwn: number;
  payers: number;
  groomShare: number;      // what each payer adds to cover the groom
  visitorPays: number;
  localPays: number;
  groomPays: number;
  groupTotal: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function computeCost(i: CostInputs, s: Scenario): CostResult {
  const groupSize = Math.max(1, Math.floor(s.groupSize));
  const locals = clamp(Math.floor(s.localGuests), 0, groupSize - 1); // the groom is never local
  const visitors = groupSize - locals - 1;

  // Stay: whole rooms are paid for, and split between the people who sleep in them.
  const bedsNeeded = i.localsNeedBed ? groupSize : groupSize - locals;
  const rooms = Math.ceil(bedsNeeded / Math.max(1, i.bedsPerRoom));
  const roomNightCost = i.roomRate * (1 + i.taxPct / 100) + i.nightlyFee;
  const stayTotal = rooms * roomNightCost * s.nights;
  const stayPerBed = stayTotal / bedsNeeded;

  const dailyTotal = i.dailySpend * s.nights;
  const visitorTransfer = i.visitorLegs * i.transferFare;
  const localTransfer = i.localLegs * i.transferFare;

  const visitorOwn = stayPerBed + dailyTotal + i.activities + visitorTransfer;
  const localOwn = (i.localsNeedBed ? stayPerBed : 0) + dailyTotal + i.activities + localTransfer;
  const groomOwn = visitorOwn; // the groom travels in and needs a bed, like a visiting guest

  // If the group covers the groom, his whole cost is spread evenly over everyone else.
  const payers = s.groomCovered ? groupSize - 1 : groupSize;
  const groomShare = s.groomCovered && payers > 0 ? groomOwn / payers : 0;

  return {
    groupSize, locals, visitors, bedsNeeded, rooms, roomNightCost, stayTotal, stayPerBed, dailyTotal,
    visitorTransfer, localTransfer, visitorOwn, localOwn, groomOwn, payers, groomShare,
    visitorPays: visitorOwn + groomShare,
    localPays: localOwn + groomShare,
    groomPays: s.groomCovered ? 0 : groomOwn,
    groupTotal: stayTotal + groupSize * (dailyTotal + i.activities) + (visitors + 1) * visitorTransfer + locals * localTransfer,
  };
}

export type Who = 'visitor' | 'local' | 'group';

export function pays(r: CostResult, who: Who): number {
  return who === 'visitor' ? r.visitorPays : who === 'local' ? r.localPays : r.groupTotal;
}

/**
 * The Boston room rate (cents per night, before tax) at which a guest pays the
 * same in both cities. The cost is a straight line in the room rate, so two
 * points are enough. Null if the rate makes no difference to this guest.
 */
export function breakEvenRoomRate(boston: CostInputs, nyc: CostInputs, s: Scenario, who: Who = 'visitor'): number | null {
  const at = (rate: number) => pays(computeCost({ ...boston, roomRate: rate }, s), who);
  const zero = at(0);
  const slope = (at(100000) - zero) / 100000;
  if (!(slope > 0)) return null;
  const rate = (pays(computeCost(nyc, s), who) - zero) / slope;
  return rate > 0 ? rate : null;
}
