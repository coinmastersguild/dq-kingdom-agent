/** Select one canonical tax receipt. Aggregate tick summaries are not receipts. */
export function observedTax(event, governedSettlements) {
 const detail=event?.detail;
 if(!detail||!['GOLD','DQS'].includes(detail.currency)||!Number.isSafeInteger(detail.tax)||detail.tax<=0)return null;
 let settlement;
 if(event.type==='market-traded')settlement=event.subject;
 else if(event.type==='caravan-delivered')settlement=detail.to;
 else if(event.type==='food-support-spent')settlement=detail.settlement;
 else return null;
 if(typeof settlement!=='string'||!governedSettlements.has(settlement))return null;
 return {settlement,currency:detail.currency,copper:detail.tax};
}

/** A failed page/read or arithmetic check must not advance the durable cursor.
 * The caller commits the returned checkpoint only after its log and file writes. */
export async function stageObservation(checkpoint, governedSettlements, readEvents, maxPages=20) {
 const next=structuredClone(checkpoint),events=[];
 for(let page=0;page<maxPages;page++){
  const batch=await readEvents(next.cursor);events.push(...batch.events);next.cursor=batch.next;if(!batch.more)break;
 }
 for(const {event} of events){
  const receipt=observedTax(event,governedSettlements);if(!receipt)continue;
  const total=next.taxCopper[receipt.currency]+receipt.copper;
  if(!Number.isSafeInteger(total))throw Error('Observed tax total exceeds exact integer range');
  next.taxCopper[receipt.currency]=total;
 }
 next.observations++;next.events+=events.length;
 return {checkpoint:next,events};
}
