// Renders a FICTIONAL prescription to a PNG for testing the S1 reader.
// Usage: node scripts/make-test-prescription.mjs <output.png>
// Doctor, clinic, patient and registration number are made up.
import { chromium } from "playwright";

const out = process.argv[2];
if (!out)
  throw new Error("Give an output path, e.g. C:/Users/me/Pictures/rx.png");

const html = `<!doctype html><html><head><style>
  body { margin: 0; background: #e9e4d8; }
  .paper { width: 760px; margin: 24px; padding: 34px 40px 30px; background: #fffdf6;
    box-shadow: 0 2px 10px rgba(0,0,0,.25); transform: rotate(-1.2deg);
    font-family: Georgia, serif; color: #222; }
  .head { display: flex; justify-content: space-between; border-bottom: 3px double #1d4e89; padding-bottom: 10px; }
  .dr { font-size: 25px; font-weight: bold; color: #1d4e89; }
  .small { font-size: 13px; line-height: 1.5; }
  .pt { display: flex; gap: 28px; font-size: 15px; margin: 14px 0 6px; border-bottom: 1px solid #bbb; padding-bottom: 8px; }
  .pt b { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-weight: normal; font-size: 19px; color: #123; }
  .rx { font-size: 46px; font-weight: bold; font-style: italic; color: #1d4e89; margin: 4px 0 0; }
  ol { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 24px; line-height: 1.75;
    color: #10306b; margin: 0 0 10px 10px; }
  li span { font-size: 19px; color: #333; }
  .adv { font-family: 'Segoe Script', cursive; font-size: 18px; color: #333; margin-top: 6px; }
  .sign { text-align: right; font-family: 'Segoe Script', cursive; font-size: 22px; margin-top: 18px; }
  .foot { font-size: 11px; color: #777; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body><div class="paper">
  <div class="head">
    <div><div class="dr">Dr. Nusrat Example</div>
      <div class="small">MBBS, FCPS (Medicine) · BMDC Reg. A-00000 (fictional)<br>Consultant, Demo Medical Centre</div></div>
    <div class="small" style="text-align:right">House 12, Road 7, Dhanmondi, Dhaka<br>Phone: 01700-000000<br>Sat–Thu, 5–9 pm</div>
  </div>
  <div class="pt"><div>Name: <b>Test Patient</b></div><div>Age: <b>34 y</b></div><div>Sex: <b>F</b></div><div>Date: <b>24/11/26</b></div></div>
  <div class="rx">℞</div>
  <ol>
    <li>Tab. Napa Extra 500+65 mg <span>— 1+1+1, after meal, 5 days</span></li>
    <li>Cap. Seclo 20 mg <span>— 1+0+1, before meal, 14 days</span></li>
    <li>Tab. Fexo 120 mg <span>— 0+0+1, 7 days</span></li>
    <li>Tab. Monas 10 mg <span>— 0+0+1, 1 month</span></li>
    <li>Tab. Azithrocin 500 mg <span>— 1+0+0, 3 days</span></li>
  </ol>
  <div class="adv">Adv: plenty of water · avoid oily food · review after 1 week</div>
  <div class="sign">N. Example</div>
  <div class="foot">FICTIONAL PRESCRIPTION — made for testing MedKothay. Not a real doctor or patient. Not for use.</div>
</div></body></html>`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 860, height: 820 } });
await page.setContent(html);
await page.locator(".paper").screenshot({ path: out });
await browser.close();
console.log(`Saved ${out}`);
