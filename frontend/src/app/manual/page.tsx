"use client";
import Image from "next/image";
import { useState } from "react";

const ANN_COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6"];
const annColor = (n: number) => ANN_COLORS[(n - 1) % ANN_COLORS.length];

interface Ann {
  x: number; y: number; n: number;
  label: string;
  dir?: "left" | "right" | "top" | "bottom";
}

interface PageDef {
  id: string; route: string;
  title: string; subtitle: string;
  annotations: Ann[];
}

const PAGES: PageDef[] = [
  {
    id: "overview", route: "/", title: "Overview Dashboard",
    subtitle: "หน้าหลัก — ภาพรวมสรุปทั้งหมดในที่เดียว",
    annotations: [
      { x: 89, y: 7,  n: 1, label: "เลือกช่วงเวลา: 24h / 7d / 30d", dir: "left" },
      { x: 42, y: 21, n: 2, label: "KPI Cards — Mentions, Positive%, Negative%, Net Sentiment, Engagement, Risk Score", dir: "bottom" },
      { x: 47, y: 53, n: 3, label: "Area Chart — Sentiment Trend แยก Positive / Neutral / Negative", dir: "top" },
      { x: 83, y: 50, n: 4, label: "Pie Chart — สัดส่วน Sentiment โดยรวม พร้อมตัวเลข", dir: "left" },
      { x: 36, y: 92, n: 5, label: "Top Channels — คลิกเพื่อกรอง Mention เฉพาะช่องทางนั้น", dir: "top" },
    ],
  },
  {
    id: "mentions", route: "/mentions", title: "Live Mentions",
    subtitle: "ฟีดโพสต์แบบ Real-time กรองได้หลายมิติ",
    annotations: [
      { x: 93, y: 7,  n: 1, label: "Refresh — โหลดข้อมูลล่าสุด", dir: "left" },
      { x: 57, y: 18, n: 2, label: "Dropdown Filter: Channel / Sentiment / Priority / Time Range", dir: "bottom" },
      { x: 57, y: 25, n: 3, label: "Keyword Chips — คลิกกรองตามคำสำคัญ ปัจจุบัน: N8, Poker, natural8...", dir: "bottom" },
      { x: 38, y: 36, n: 4, label: "Mention Card — Channel badge, Sentiment, Priority, เวลาโพสต์", dir: "right" },
      { x: 38, y: 62, n: 5, label: "AI Summary — ย่อเนื้อหาด้วย AI สีฟ้า (อ่านง่ายกว่าต้นฉบับ)", dir: "right" },
      { x: 38, y: 91, n: 6, label: "Likes / Risk Score / ปุ่ม 'รายละเอียด' — คลิกดู Slide-in panel", dir: "right" },
    ],
  },
  {
    id: "quick-add", route: "/quick-add", title: "Quick Add",
    subtitle: "เพิ่มโพสต์ด้วยมือ หรือผ่าน Bookmarklet",
    annotations: [
      { x: 82, y: 5,  n: 1, label: "Bookmarklet — กดแล้วลาก script ไปที่ Bookmark Bar ของ Browser", dir: "left" },
      { x: 55, y: 21, n: 2, label: "เลือก Channel: Facebook, Instagram, TikTok, X, YouTube, Pantip, LINE OA, News, Webboard", dir: "bottom" },
      { x: 55, y: 43, n: 3, label: "URL ของโพสต์ต้นทาง (ไม่บังคับ)", dir: "right" },
      { x: 55, y: 65, n: 4, label: "เนื้อหาโพสต์ (* จำเป็น) — วาง text ที่นี่", dir: "right" },
      { x: 55, y: 88, n: 5, label: "ชื่อผู้โพสต์ + Engagement: Likes, Comments, Shares", dir: "right" },
    ],
  },
  {
    id: "sentiment", route: "/sentiment", title: "Sentiment Analysis",
    subtitle: "วิเคราะห์อารมณ์ผู้พูดถึง 14 วันย้อนหลัง",
    annotations: [
      { x: 33, y: 18, n: 1, label: "Positive % — สีเขียว ยิ่งสูงยิ่งดี", dir: "right" },
      { x: 62, y: 18, n: 2, label: "Neutral % — โพสต์กลางๆ ไม่บวกไม่ลบ", dir: "bottom" },
      { x: 88, y: 18, n: 3, label: "Negative % — สีแดง เฝ้าระวังถ้าเกิน 30%", dir: "left" },
      { x: 60, y: 62, n: 4, label: "Grouped Bar Chart รายวัน — มองหา Spike สีแดงที่ผิดปกติ", dir: "top" },
    ],
  },
  {
    id: "user-trends", route: "/user-trends", title: "User Trends",
    subtitle: "ติดตามพฤติกรรมรายบุคคล + Watchlist",
    annotations: [
      { x: 89, y: 7,  n: 1, label: "เลือก Time Range: 7d / 14d / 30d / 90d", dir: "left" },
      { x: 45, y: 17, n: 2, label: "KPI Cards: Total Users, Watchlist count, High-risk, Negative >40%", dir: "bottom" },
      { x: 55, y: 45, n: 3, label: "Stacked Bar ต่อ User — สัดส่วน Positive/Neutral/Negative", dir: "top" },
      { x: 77, y: 68, n: 4, label: "Risk Score — เขียว=ต่ำ, เหลือง=กลาง, แดง=สูง (≥7 ต้องระวัง)", dir: "left" },
      { x: 91, y: 68, n: 5, label: "ปุ่ม Watch/Unwatch — เพิ่ม/ลบออกจาก Watchlist", dir: "left" },
    ],
  },
  {
    id: "topics", route: "/topics", title: "Topics & Trends",
    subtitle: "หัวข้อที่คนพูดถึงมากที่สุด จำแนกด้วย AI",
    annotations: [
      { x: 55, y: 30, n: 1, label: "Bar Chart Top 10 Topics — สีตาม Sentiment ที่ dominant", dir: "top" },
      { x: 38, y: 65, n: 2, label: "Topic Name — AI จำแนกอัตโนมัติจากเนื้อหาโพสต์", dir: "right" },
      { x: 62, y: 65, n: 3, label: "Share % + Mini progress bar — สัดส่วนการพูดถึง", dir: "bottom" },
      { x: 80, y: 65, n: 4, label: "Positive / Negative % ต่อหัวข้อ", dir: "left" },
    ],
  },
  {
    id: "competitors", route: "/competitors", title: "Competitors / Share of Voice",
    subtitle: "เปรียบ Keyword ว่าใครถูกพูดถึงมากกว่า",
    annotations: [
      { x: 55, y: 20, n: 1, label: "SOV Bar — แต่ละสีคือ 1 Keyword ความกว้าง = Share %", dir: "bottom" },
      { x: 55, y: 45, n: 2, label: "Volume Bar Chart — เปรียบ Mention count แต่ละ Keyword", dir: "top" },
      { x: 38, y: 70, n: 3, label: "SOV % พร้อม Mini bar inline", dir: "right" },
      { x: 72, y: 70, n: 4, label: "Negative % ของคู่แข่ง — ถ้าสูง คือโอกาสของเรา", dir: "left" },
    ],
  },
  {
    id: "crisis", route: "/crisis", title: "Crisis Center",
    subtitle: "ตรวจจับวิกฤตแบบ Real-time ใน 24 ชั่วโมง",
    annotations: [
      { x: 33, y: 17, n: 1, label: "Crisis Level: Low / Medium / High / Critical", dir: "right" },
      { x: 62, y: 17, n: 2, label: "Avg Risk Score + Progress bar มาตรวัด", dir: "bottom" },
      { x: 88, y: 17, n: 3, label: "Negative Rate % + จำนวน Mention ใน 24 ชม.", dir: "left" },
      { x: 55, y: 60, n: 4, label: "Critical Mentions — โพสต์ Priority=Critical ล่าสุด 10 รายการ", dir: "top" },
    ],
  },
  {
    id: "query-builder", route: "/query-builder", title: "Query Builder",
    subtitle: "ค้นหาขั้นสูงด้วย Boolean Search",
    annotations: [
      { x: 55, y: 20, n: 1, label: "พิมพ์ Query: AND / OR / NOT / #hashtag / @author / site:domain", dir: "bottom" },
      { x: 35, y: 33, n: 2, label: "Operator Buttons — คลิกแทรก AND/OR/NOT ได้เลยไม่ต้องพิมพ์", dir: "right" },
      { x: 77, y: 33, n: 3, label: "เลือก Time Range และ Channel ก่อน Run", dir: "left" },
      { x: 55, y: 43, n: 4, label: "ปุ่ม Run Query (Ctrl+Enter) — ผลสูงสุด 100 รายการ", dir: "top" },
    ],
  },
  {
    id: "keywords", route: "/keywords", title: "Keywords",
    subtitle: "เพิ่ม / ลบ / บริหาร Keyword ที่ต้องติดตาม",
    annotations: [
      { x: 33, y: 18, n: 1, label: "Active Keywords — คำที่ใช้ติดตามอยู่ (ปัจจุบัน 6 คำ)", dir: "right" },
      { x: 62, y: 18, n: 2, label: "Negative Keywords — คำสัญญาณวิกฤต (ปัจจุบัน 0)", dir: "bottom" },
      { x: 88, y: 18, n: 3, label: "Total Matches — ยอดรวมที่ระบบตรวจเจอ (278)", dir: "left" },
      { x: 42, y: 41, n: 4, label: "ช่องพิมพ์ Keyword + เลือก Category (brand/product/crisis...)", dir: "bottom" },
      { x: 80, y: 41, n: 5, label: "ติ๊ก Negative + กด Add Keyword", dir: "left" },
      { x: 86, y: 68, n: 6, label: "Toggle เปิด/ปิด (ไม่ต้องลบ) — ปุ่มแดงคือลบถาวร", dir: "left" },
    ],
  },
  {
    id: "alerts", route: "/alerts", title: "Alerts",
    subtitle: "ตั้งค่าการแจ้งเตือน — Email, LINE, Telegram",
    annotations: [
      { x: 55, y: 25, n: 1, label: "Alert Type Cards — Toggle แต่ละประเภท: Negative Spike, Keyword, Influencer, SLA", dir: "bottom" },
      { x: 55, y: 50, n: 2, label: "Crisis Keywords Preview — คำ Negative ที่ตั้งในหน้า Keywords", dir: "top" },
      { x: 55, y: 68, n: 3, label: "Notification Channels: Email / LINE Notify Token / Telegram Bot Token", dir: "top" },
      { x: 88, y: 88, n: 4, label: "Save — บันทึกลง localStorage ของ Browser", dir: "left" },
    ],
  },
  {
    id: "data-sources", route: "/data-sources", title: "Data Sources",
    subtitle: "เปิด/ปิดช่องทางการเก็บข้อมูล",
    annotations: [
      { x: 38, y: 30, n: 1, label: "Channel Card — ไอคอน, ชื่อ, วันที่ Sync ล่าสุด", dir: "right" },
      { x: 82, y: 22, n: 2, label: "Toggle เปิด/ปิดช่องทาง — บันทึกทันที (PATCH /api/channels)", dir: "left" },
      { x: 38, y: 55, n: 3, label: "เมื่อ Toggle เปิด — ช่องใส่ Webhook URL ปรากฏขึ้น", dir: "right" },
    ],
  },
  {
    id: "qc", route: "/qc", title: "LINE OA QC",
    subtitle: "วัดประสิทธิภาพทีม Admin ที่ตอบ LINE OA",
    annotations: [
      { x: 10, y: 60, n: 1, label: "Rank ตาม Score รวม", dir: "right" },
      { x: 35, y: 60, n: 2, label: "Total Chats + Avg Response Time (นาที)", dir: "right" },
      { x: 62, y: 60, n: 3, label: "SLA Pass % — เขียว=ผ่าน, แดง=ไม่ผ่าน", dir: "bottom" },
      { x: 87, y: 60, n: 4, label: "Score รวม — เขียว≥90, เหลือง≥75, แดง<75", dir: "left" },
    ],
  },
  {
    id: "reports", route: "/reports", title: "Reports",
    subtitle: "สรุปรายงาน Export CSV ได้",
    annotations: [
      { x: 75, y: 7,  n: 1, label: "Export CSV — ดาวน์โหลดข้อมูลดิบทั้งหมด", dir: "left" },
      { x: 40, y: 20, n: 2, label: "KPI Summary: Mentions, Net Sentiment, Engagement, Risk Score", dir: "right" },
      { x: 55, y: 42, n: 3, label: "Sentiment Breakdown + Channel Distribution — Progress Bars", dir: "top" },
      { x: 55, y: 62, n: 4, label: "AI Auto-Generated Summary — ย่อผลเป็นประโยคภาษาอังกฤษ", dir: "top" },
      { x: 55, y: 82, n: 5, label: "Export Templates: Executive / Crisis / Campaign / Admin QC", dir: "top" },
    ],
  },
  {
    id: "integrations", route: "/integrations", title: "Integration Guide",
    subtitle: "เชื่อมต่อข้อมูลจากทุกช่องทาง — สำหรับนักพัฒนา",
    annotations: [
      { x: 55, y: 20, n: 1, label: "Architecture Diagram — Flow ข้อมูลตั้งแต่ต้นทางถึง Dashboard", dir: "top" },
      { x: 55, y: 50, n: 2, label: "ChannelCard Accordion — คลิกขยายดูขั้นตอน Setup + Python Code", dir: "top" },
      { x: 55, y: 75, n: 3, label: "Automation Tools: n8n, Make.com, Apify พร้อม External links", dir: "top" },
    ],
  },
  {
    id: "settings", route: "/settings", title: "Settings",
    subtitle: "ตั้งค่าระบบ — Threshold, API Keys, Roles",
    annotations: [
      { x: 55, y: 18, n: 1, label: "API Configuration — Backend URL, OpenAI Key (read-only)", dir: "top" },
      { x: 55, y: 36, n: 2, label: "Environment Status — เช็คสถานะ DB, API, OpenAI: เขียว=OK, แดง=ผิดพลาด", dir: "top" },
      { x: 40, y: 58, n: 3, label: "Negative Spike Threshold Slider (5–50%) — ต่ำ=แจ้งบ่อย, สูง=แจ้งเฉพาะวิกฤต", dir: "right" },
      { x: 40, y: 70, n: 4, label: "Risk Score Alert Threshold — แนะนำตั้งที่ 7 สำหรับทีมขนาดกลาง", dir: "right" },
      { x: 55, y: 87, n: 5, label: "Roles & Permissions — ตารางบทบาท 7 ระดับ ตั้งแต่ Super Admin ถึง Executive", dir: "top" },
    ],
  },
];

function AnnOverlay({ anns }: { anns: Ann[] }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 625"
      preserveAspectRatio="none"
    >
      {anns.map((a) => {
        const x = (a.x / 100) * 1000;
        const y = (a.y / 100) * 625;
        const col = annColor(a.n);
        const dir = a.dir ?? "right";
        const lbl = a.label;
        const lw = Math.min(lbl.length * 8 + 24, 300);
        const lh = 26;
        const PAD = 18;

        let lx = 0, ly = 0;
        if (dir === "right") { lx = x + PAD; ly = y - lh / 2; }
        else if (dir === "left") { lx = x - PAD - lw; ly = y - lh / 2; }
        else if (dir === "bottom") { lx = x - lw / 2; ly = y + PAD; }
        else { lx = x - lw / 2; ly = y - PAD - lh; }

        lx = Math.max(4, Math.min(lx, 1000 - lw - 4));
        ly = Math.max(4, Math.min(ly, 625 - lh - 4));

        const ex = x + (dir === "right" ? 10 : dir === "left" ? -10 : 0);
        const ey = y + (dir === "bottom" ? 10 : dir === "top" ? -10 : 0);

        return (
          <g key={a.n}>
            <circle cx={x} cy={y} r={14} fill={col} opacity={0.2} />
            <circle cx={x} cy={y} r={10} fill={col} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="white" fontFamily="system-ui">
              {a.n}
            </text>
            <line
              x1={ex} y1={ey} x2={lx + lw / 2} y2={ly + lh / 2}
              stroke={col} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7}
            />
            <rect x={lx} y={ly} width={lw} height={lh} rx={5}
              fill="white" stroke={col} strokeWidth={1.5} opacity={0.96} />
            <text x={lx + 10} y={ly + 17} fontSize={11} fill="#1A2233" fontFamily="system-ui,'Noto Sans Thai',sans-serif">
              {lbl}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ManualPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Inner TOC */}
      <aside className="w-48 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-gray-200 bg-white hidden lg:flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">คู่มือการใช้งาน</p>
        </div>
        <nav className="p-2 flex-1">
          {PAGES.map((pg) => (
            <a
              key={pg.id}
              href={`#${pg.id}`}
              onClick={() => setActiveId(pg.id)}
              className={`block px-3 py-1.5 rounded-md text-xs mb-0.5 transition-colors ${
                activeId === pg.id
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {pg.title}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 p-6 pb-20">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-xl p-7 text-white mb-8">
            <h1 className="text-2xl font-bold mb-1">คู่มือการใช้งาน SocialEye Monitor</h1>
            <p className="text-blue-100 text-sm leading-relaxed max-w-xl">
              ภาพ Screenshot จริงของแต่ละหน้า พร้อม Annotation วงกลมสีชี้ตำแหน่ง UI สำคัญ
              ดูตารางด้านล่างภาพเพื่ออ่านคำอธิบาย
            </p>
            <div className="flex gap-6 mt-4">
              <div><span className="text-2xl font-bold">16</span><div className="text-xs text-blue-200">หน้าระบบ</div></div>
              <div><span className="text-2xl font-bold">9</span><div className="text-xs text-blue-200">ช่องทาง</div></div>
              <div><span className="text-2xl font-bold">AI</span><div className="text-xs text-blue-200">วิเคราะห์อัตโนมัติ</div></div>
            </div>
          </div>

          {/* Page Sections */}
          {PAGES.map((pg) => (
            <section
              key={pg.id}
              id={pg.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6 scroll-mt-4"
            >
              {/* Section header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
                <div>
                  <span className="inline-block font-mono text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 mb-1">
                    {pg.route}
                  </span>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">{pg.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{pg.subtitle}</p>
                </div>
              </div>

              {/* Screenshot + annotations */}
              <div className="relative bg-black" style={{ aspectRatio: "1280/800" }}>
                <Image
                  src={`/manual/${pg.id}.jpg`}
                  alt={pg.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 900px) 100vw, 860px"
                  priority={pg.id === "overview"}
                />
                <AnnOverlay anns={pg.annotations} />
              </div>

              {/* Legend */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2">
                {pg.annotations.map((a) => (
                  <div key={a.n} className="flex items-center gap-2 text-xs text-gray-600">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                      style={{ background: annColor(a.n), fontSize: 10 }}
                    >
                      {a.n}
                    </span>
                    {a.label}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="text-center text-xs text-gray-400 mt-8">
            SocialEye Monitor v1.0.0 · N8 Thailand
          </div>
        </div>
      </main>
    </div>
  );
}
