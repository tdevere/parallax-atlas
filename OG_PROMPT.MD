You are an expert full-stack developer and GitHub Copilot-powered coding agent. Your mission is to build the \*\*first testable MVP\*\* of a professional timeline visualization tool called "Knowledge Timeline Map".



Project Goal (high-level):

Create a web app where time since the Big Bang (~13.8 billion years ago) is visualized as horizontal colored blocks on a zoomable/pannable timeline. Each block represents a major era or event in cosmic, geological, biological, and human history. Blocks change color based on a user's self-reported "knowledge level" (0–100%) for associated topics — from gray (unlearned) → blue/green/yellow → gold (mastered). The timeline uses a logarithmic scale so ancient history is visible but recent eras have more space.



Target: A single-page React app that runs locally with `npm run dev`, looks clean in dark mode, and demonstrates core functionality.



Tech Stack (do NOT change unless absolutely necessary):

\- Vite + React + TypeScript

\- vis-timeline (for the timeline — install vis-timeline and vis-data)

\- Tailwind CSS + shadcn/ui components (for clean, modern UI)

\- No backend — all data static + localStorage for progress



Step-by-step instructions — follow in order, commit often with clear messages:



1\. Project Setup

   - Initialize a fresh Vite project if not already present: `npm create vite@latest . -- --template react-ts`

   - Install dependencies:

     npm install vis-timeline vis-data tailwindcss postcss autoprefixer @radix-ui/react-slider class-variance-authority clsx tailwind-merge

     npx tailwindcss init -p

   - Configure tailwind.config.js to scan src/\*\*/\*.{ts,tsx}

   - Add to src/index.css: @tailwind base; @tailwind components; @tailwind utilities; and basic dark body styles (bg-gray-950 text-gray-100)



2\. Folder Structure

   Create this exact structure:

   src/

   ├── components/

   │   ├── Timeline.tsx          # main vis-timeline wrapper

   │   ├── ProgressSidebar.tsx   # sidebar with sliders/toggles

   │   └── EraDetailModal.tsx    # optional modal on click

   ├── data/

   │   └── timeline-data.ts      # eras array + types

   ├── App.tsx

   ├── main.tsx

   └── index.css



3\. Data Model (src/data/timeline-data.ts)

   Define:

   export interface Era {

     id: string;

     content: string;           // display label e.g. "Big Bang"

     start: number;             // years ago (positive number, larger = older)

     end: number;               // years ago

     group: string;             // e.g. "Cosmology", "Geology", "Biology", "Human History"

     description?: string;

     defaultColor?: string;

   }



   Export ~15–20 sample eras (hardcoded). Examples (use approximate values):

   - Big Bang: start 13800000000, end 13750000000, group "Cosmology"

   - Reionization: ~1.2e9 ya

   - Milky Way formation: ~1e10 ya

   - Solar System: 4.6e9 ya

   - First life: 3.8e9 ya

   - Cambrian Explosion: 5.4e8 ya

   - Dinosaurs: 2.3e8 – 6.6e7 ya

   - Homo sapiens: 3e5 ya

   - Agriculture: 1.2e4 ya

   - Industrial Revolution: 250 ya

   - Internet era: 40 ya

   - Today: 0 ya



   Make start > end (since larger numbers = further in past). Use scientific notation where helpful.



4\. Timeline Component (src/components/Timeline.tsx)

   - Use vis-timeline/standalone + vis-data

   - Create a DataSet for items and groups (groups = domains like Cosmology, Biology…)

   - Implement logarithmic time axis:

     - Convert years-ago to a log scale (e.g. log10(yearsAgo + 1) or custom mapper)

     - Custom format function for axis labels: show e.g. "13.8 Bya", "4.6 Bya", "10,000 ya", "2025 CE"

     - Use options: { timeAxis: { scale: 'year', step: 1 }, zoomMin: 1e6, zoomMax: 1e13 \* 1000 } (adjust units)

   - Items: each era as a range bar, initial className or style based on progress (start gray)

   - Support zoom, pan, click to show details

   - Expose prop: onProgressChange?(id: string, value: number) to update colors live



5\. Progress State \& Sidebar (src/components/ProgressSidebar.tsx)

   - Use React state or localStorage for progress: Record<string, number> e.g. { "1": 75 } // era id → 0-100

   - Sidebar with:

     - Grouped list or accordions by domain

     - Slider (use @radix-ui/react-slider) per era/topic to set 0–100%

     - Real-time color update on timeline when slider changes

   - Color logic: 0% → gray-700, 25% → blue-600, 50% → green-500, 75% → yellow-400, 100% → amber-300/gold



6\. App.tsx

   - Layout: flex row — left: sidebar (w-80), right: timeline (flex-1)

   - Load eras from data, initialize progress from localStorage or default 0

   - Pass progress to Timeline and update on slider change



7\. Polish

   - Dark theme throughout

   - Responsive (sidebar collapses on mobile if possible)

   - Add a header: "Knowledge Timeline Map – Your Universe of Understanding"

   - Optional: button to export progress as JSON



8\. Testing \& Validation

   - Run `npm run dev` — timeline should render, zoom from cosmic to modern, blocks visible

   - Move sliders → blocks change color instantly

   - Commit each major step with messages like "feat: add logarithmic timeline", "feat: progress sidebar \& color mapping"



Constraints:

\- Do NOT add authentication, backend, or extra libraries beyond listed

\- Keep code clean, typed, modular

\- If stuck on vis-timeline log scale, search docs or approximate with custom time conversion function

\- After finishing MVP, output: "MVP complete. Run npm run dev and open localhost:5173"



Begin now. Think step-by-step, write code only when ready, and confirm each phase complete before next.

