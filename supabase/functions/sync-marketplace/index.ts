// Supabase Edge Function: sync-marketplace
// Deploy as: supabase functions deploy sync-marketplace
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("Authorization"); if(!auth) return json({error:"Sign-in required"},401);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:userErr}=await userClient.auth.getUser(); if(userErr||!user) return json({error:"Invalid session"},401);
 const admin=createClient(url,service);
 const {platform}=await req.json(); if(!["ebay","whatnot"].includes(platform)) return json({error:"Unknown platform"},400);
 const {data:run}=await admin.from("business_sync_runs").insert({user_id:user.id,platform,status:"running"}).select("id").single();
 try {
  let imported=0;
  if(platform==="ebay") imported=await syncEbay(admin,user.id);
  else imported=await syncWhatnot(admin,user.id);
  await admin.from("business_sync_runs").update({status:"success",imported_count:imported,finished_at:new Date().toISOString()}).eq("id",run.id);
  return json({ok:true,platform,imported});
 } catch(e) {
  const message=e instanceof Error?e.message:String(e);
  if(run?.id) await admin.from("business_sync_runs").update({status:"error",error_message:message.slice(0,1000),finished_at:new Date().toISOString()}).eq("id",run.id);
  return json({error:message},502);
 }
});
async function syncEbay(db:any,userId:string){
 const id=Deno.env.get("EBAY_CLIENT_ID"),secret=Deno.env.get("EBAY_CLIENT_SECRET"),refresh=Deno.env.get("EBAY_REFRESH_TOKEN");
 if(!id||!secret||!refresh) throw new Error("Missing EBAY_CLIENT_ID, EBAY_CLIENT_SECRET or EBAY_REFRESH_TOKEN Edge Function secrets.");
 const basic=btoa(id+":"+secret);
 const tokenRes=await fetch("https://api.ebay.com/identity/v1/oauth2/token",{method:"POST",headers:{"Authorization":"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh,scope:"https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"})});
 if(!tokenRes.ok) throw new Error("eBay OAuth refresh failed: "+tokenRes.status+" "+(await tokenRes.text()).slice(0,300));
 const token=(await tokenRes.json()).access_token;
 const from=new Date(Date.now()-90*86400000).toISOString();
 const filter="creationdate:[ "+from+".."+new Date().toISOString()+" ]";
 const api="https://api.ebay.com/sell/fulfillment/v1/order?limit=200&filter="+encodeURIComponent(filter);
 const res=await fetch(api,{headers:{"Authorization":"Bearer "+token,"X-EBAY-C-MARKETPLACE-ID":Deno.env.get("EBAY_MARKETPLACE_ID")||"EBAY_AU"}});
 if(!res.ok) throw new Error("eBay orders request failed: "+res.status+" "+(await res.text()).slice(0,300));
 const body=await res.json(); let count=0;
 for(const order of (body.orders||[])){
  for(const line of (order.lineItems||[])){
   const amount=Number(line.lineItemCost?.value||line.total?.value||line.lineItemCost?.convertedFromValue||0);
   const row={user_id:userId,platform:"ebay",external_order_id:String(order.orderId),external_line_id:String(line.lineItemId||line.legacyItemId||""),sale_date:order.creationDate||new Date().toISOString(),item_name:line.title||"eBay item",quantity:Number(line.quantity||1),gross_item_amount:amount,buyer_shipping:Number(order.pricingSummary?.deliveryCost?.value||0),currency:line.lineItemCost?.currency||"AUD",status:order.orderFulfillmentStatus||order.orderPaymentStatus||"completed",raw_data:order};
   const {error}=await db.from("business_sales").upsert(row,{onConflict:"user_id,platform,external_order_id,external_line_id",ignoreDuplicates:true});
   if(error) throw error; count++;
  }
 }
 return count;
}
async function syncWhatnot(db:any,userId:string){
 const apiKey=Deno.env.get("WHATNOT_API_TOKEN"); if(!apiKey) throw new Error("Missing WHATNOT_API_TOKEN Edge Function secret.");
 let next:string|null=""; let count=0; let pages=0;
 do {
  const endpoint="https://api.whatnot.com/seller-api/rest/v2/orders"+(next?"?cursor="+encodeURIComponent(next):"");
  const res=await fetch(endpoint,{headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"}});
  if(!res.ok) throw new Error("Whatnot orders request failed: "+res.status+" "+(await res.text()).slice(0,300));
  const body=await res.json(); const orders=body.orders||body.data||[];
  for(const order of orders){
   const lines=order.items||order.line_items||order.order_items||[];
   for(const line of lines){
    const amount=Number(line.total?.amount??line.price?.amount??line.total_amount??line.price??0);
    const row={user_id:userId,platform:"whatnot",external_order_id:String(order.id||order.order_id),external_line_id:String(line.id||line.item_id||""),sale_date:order.created_at||order.createdAt||new Date().toISOString(),item_name:line.title||line.name||"Whatnot item",quantity:Number(line.quantity||1),gross_item_amount:amount,buyer_shipping:Number(line.shipping_amount||0),currency:line.currency||"AUD",show_name:order.show?.title||order.show_name||"",status:order.status||"completed",raw_data:order};
    const {error}=await db.from("business_sales").upsert(row,{onConflict:"user_id,platform,external_order_id,external_line_id",ignoreDuplicates:true});if(error)throw error;count++;
   }
  }
  next=body.next_cursor||body.nextCursor||null;pages++;
 } while(next&&pages<10);
 return count;
}
