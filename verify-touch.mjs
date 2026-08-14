import puppeteer from "puppeteer";
const BASE = process.env.BASE || "http://localhost:3100";
const b = await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
const p = await b.newPage();
await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
await p.goto(BASE+"/login",{waitUntil:"networkidle2"});
await p.type("#email","mobileaudit@example.com");
await p.type("#password","AuditPass123!");
await Promise.all([p.click('button[type="submit"]'), p.waitForNavigation({waitUntil:"networkidle2"}).catch(()=>{})]);
await new Promise(r=>setTimeout(r,3000));
await p.goto(BASE+"/library/movies",{waitUntil:"networkidle2"});
await new Promise(r=>setTimeout(r,3000));
console.log(JSON.stringify(await p.evaluate(()=>{
  const el=document.querySelector('.touch-visible');
  const sortBtn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Sort:'));
  return {
    coarse: matchMedia('(pointer: coarse)').matches,
    cardActionsOpacity: el ? getComputedStyle(el).opacity : 'not found',
    cardActionsRect: el ? (r=>({w:Math.round(r.width),h:Math.round(r.height)}))(el.getBoundingClientRect()) : null,
    sortBtnHeight: sortBtn ? Math.round(sortBtn.getBoundingClientRect().height) : null,
  };
}),null,2));
await p.evaluate(()=>document.querySelectorAll("nextjs-portal").forEach(e=>e.remove()));
await p.evaluate(()=>window.scrollTo(0,700));
await new Promise(r=>setTimeout(r,800));
await p.screenshot({path:"/home/metamorphosis/Lumiere/.playwright-mcp/shots/prod-library-touch.png"});
await b.close();
