<script>
  import ModuleShell from './ModuleShell.svelte';
  import { fv, tc, tb } from './utils.js';

  const ACCENT = '#c084fc';

  const examples = [
    { label: 'Object Literal',    code: 'let user = { name: "Alice", age: 25 };\nconsole.log(user.name);\nconsole.log(user.age);',                                                                                                                                                  complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Creating an object literal and accessing properties by key are both O(1) — constant time. The JS engine uses a hash map internally, so property lookup does not depend on the number of keys.', spaceWhy: 'O(1) — the object stores a fixed number of key-value pairs. Memory is proportional to the number of properties, which is constant here (2 keys).' } },
    { label: 'Nested Objects',    code: 'let config = {\n  db: { host: "localhost", port: 5432 },\n  cache: { ttl: 300 }\n};\nlet dbHost = config.db.host;\nconsole.log(dbHost);',                                                                                               complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Nested property access like config.db.host is still O(1) — each dot lookup is a hash map access. Two lookups chained together is still constant time.', spaceWhy: 'O(1) — nested objects are stored as references. The outer object holds pointers to inner objects on the heap.' } },
    { label: 'Dynamic Keys',      code: 'let scores = {};\nscores["math"] = 95;\nscores["science"] = 87;\nscores["english"] = 91;\nconsole.log(scores["math"]);',                                                                                                                   complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Bracket notation obj["key"] performs the same hash lookup as dot notation. Adding a new key to an object is amortized O(1).', spaceWhy: 'O(1) — each property addition allocates a small constant amount of memory for the key-value pair in the hash map.' } },
    { label: 'Object.keys/values', code: 'let car = { make: "Toyota", model: "Camry", year: 2024 };\nlet keys = Object.keys(car);\nlet vals = Object.values(car);\nconsole.log(keys);\nconsole.log(vals);',                                                                       complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'Object.keys() and Object.values() iterate over ALL properties to build a new array. If the object has n keys, both operations are O(n). They must visit every key-value pair.', spaceWhy: 'O(n) — both methods create a NEW array containing n elements (the keys or values). This is additional memory proportional to the object size.' } },
    { label: 'Destructuring',     code: 'let point = { x: 10, y: 20, z: 30 };\nlet { x, y } = point;\nconsole.log(x);\nconsole.log(y);',                                                                                                                                           complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'Destructuring { x, y } = point is syntactic sugar for x = point.x; y = point.y. Each is an O(1) hash lookup. The number of destructured keys is fixed (not dependent on object size).', spaceWhy: 'O(1) — destructuring creates individual variables on the stack, each holding a copy/reference of the extracted value.' } },
    { label: 'Spread & Merge',    code: 'let defaults = { theme: "dark", lang: "en" };\nlet prefs = { lang: "fr", fontSize: 14 };\nlet merged = { ...defaults, ...prefs };\nconsole.log(merged.theme);\nconsole.log(merged.lang);',                                               complexity: { time: 'O(n)', space: 'O(n)', timeWhy: 'The spread operator {...obj} iterates over all enumerable properties. Merging two objects with spread copies every key-value pair from both, making it O(n + m) where n and m are the sizes of each object.', spaceWhy: 'O(n+m) — a completely new object is allocated containing all keys from both source objects. The originals remain unchanged.' } },
  ];

  /** Add ObjExplorer-specific fields */
  function mapStep(s) {
    return {
      ...s,
      objOps:       s.objOps || 0,
      highlightKey: s.highlightKey || null,
    };
  }
</script>

<!-- ── ObjExplorer module ───────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="obj"
  titleAccent="Explorer"
  subtitle="— Objects"
  desc="See how key-value pairs are stored in hash maps on the heap — property access, nesting, spread, destructuring"
  interpreterOptions={{ trackObjects: true }}
  {mapStep}
  showHeap={false}
>

  <!-- CPU right-column registers: OBJ-OPS + TARGET + HEAP count -->
  {#snippet cpuRegisters(sd)}
    <rect x="210" y="14" width="68" height="22" rx="4" fill="#08080e"
      stroke={sd.objOps > 0 ? '#c084fc33' : '#1a1a2e'} stroke-width="1"/>
    <text x="216" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">OBJ-OPS</text>
    <text x="272" y="29" text-anchor="end" fill={sd.objOps > 0 ? ACCENT : '#222'} font-size="12" font-weight="800" font-family="monospace">{sd.objOps}</text>

    <rect x="284" y="14" width="66" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="290" y="22" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">TARGET</text>
    <text x="344" y="29" text-anchor="end" fill={ACCENT} font-size="9" font-weight="700" font-family="monospace">{sd.highlight || '—'}</text>

    <rect x="210" y="40" width="140" height="22" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
    <text x="216" y="48" fill="#444" font-size="6" font-family="monospace" letter-spacing="0.5">HEAP</text>
    <text x="344" y="55" text-anchor="end" fill="#888" font-size="8" font-weight="700" font-family="monospace">
      {Object.entries(sd.vars || {}).filter(([, v]) => typeof v === 'object' && v !== null).length} objects
    </text>
  {/snippet}

  <!-- CPU right gauge: object ops -->
  {#snippet cpuGauge(sd)}
    <rect x="246" y="68" width="104" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
    <rect x="247" y="69" width={Math.min(102, sd.objOps * 15)} height="14" rx="2" fill={ACCENT} opacity="0.2"/>
    <text x="252" y="79" fill="#666" font-size="6.5" font-family="monospace">{sd.objOps} OBJ OPS</text>
  {/snippet}

  <!-- Object property visualization + scalar heap -->
  {#snippet topPanel(sd)}
    <!-- Object cards -->
    {#each Object.entries(sd.vars || {}).filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v)) as [objName, objVal]}
      <div class="obj-card">
        <div class="obj-card-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <text x="1"  y="11" fill={ACCENT} font-size="11" font-family="monospace" font-weight="700">{'{'}</text>
            <text x="8"  y="11" fill={ACCENT} font-size="11" font-family="monospace" font-weight="700" opacity="0.4">{'}'}</text>
          </svg>
          <span class="obj-card-title">{objName}</span>
          <span class="obj-card-count">{Object.keys(objVal).length} keys</span>
        </div>
        <div class="obj-props">
          {#each Object.entries(objVal) as [key, val]}
            <div class="obj-prop" class:prop-hl={sd.highlight === objName && sd.highlightKey === key}>
              <span class="prop-key">"{key}"</span>
              <span class="prop-sep">:</span>
              {#if typeof val === 'object' && val !== null}
                <span class="prop-val" style="color:{ACCENT}">{JSON.stringify(val)}</span>
              {:else}
                <span class="prop-val" style="color:{tc(val)}">{fv(val)}</span>
              {/if}
              <span class="prop-type" style="color:{tc(val)}">{tb(val)}</span>
            </div>
          {/each}
          {#if Object.keys(objVal).length === 0}
            <div class="obj-empty">{'{ }'} empty object</div>
          {/if}
        </div>
      </div>
    {/each}

    <!-- Scalars & arrays -->
    {#if Object.entries(sd.vars || {}).some(([, v]) => typeof v !== 'object' || v === null || Array.isArray(v))}
      <div class="scalars-card">
        <div class="scalars-hdr">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="1" y="1" width="5" height="5" rx="1" fill={ACCENT} opacity="0.5"/>
            <rect x="8" y="1" width="5" height="5" rx="1" fill={ACCENT} opacity="0.3"/>
            <rect x="1" y="8" width="5" height="5" rx="1" fill={ACCENT} opacity="0.3"/>
            <rect x="8" y="8" width="5" height="5" rx="1" fill={ACCENT} opacity="0.15"/>
          </svg>
          <span class="scalars-label">SCALARS & ARRAYS</span>
        </div>
        <div class="scalars-grid">
          {#each Object.entries(sd.vars || {}).filter(([, v]) => typeof v !== 'object' || v === null || Array.isArray(v)) as [key, val]}
            <div class="sc-box" class:sc-flash={sd.highlight === key}>
              <div class="sc-hdr">
                <span class="sc-name">{key}</span>
                <span class="sc-type" style="color:{tc(val)}">{tb(val)}</span>
              </div>
              <div class="sc-val" style="color:{tc(val)}">{fv(val)}</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}

  <!-- Complexity live stats -->
  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.objOps} obj ops
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  <!-- Placeholder -->
  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 200 140" class="ph-svg">
        <text x="70"  y="45"  fill="#1a1a2e" font-size="24" font-family="monospace" font-weight="700">{'{'}</text>
        <text x="85"  y="65"  fill="#1a1a2e" font-size="8"  font-family="monospace">k: v</text>
        <text x="85"  y="80"  fill="#1a1a2e" font-size="8"  font-family="monospace">k: v</text>
        <text x="110" y="95"  fill="#1a1a2e" font-size="24" font-family="monospace" font-weight="700">{'}'}</text>
        <text x="100" y="125" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">key-value hash map</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see objects in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Object cards */
  .obj-card      { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .obj-card-hdr  { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .obj-card-title { font-size:0.65rem; color:#c084fc; font-family:'SF Mono',monospace; font-weight:700; }
  .obj-card-count { margin-left:auto; font-size:0.5rem; color:#444; font-family:monospace; }
  .obj-props     { padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
  .obj-prop      { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:4px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .prop-hl       { border-color:#c084fc44; background:#c084fc08; box-shadow:inset 3px 0 0 #c084fc; }
  .prop-key      { font-size:0.7rem; color:#e0e0e0; font-family:'SF Mono',monospace; font-weight:600; }
  .prop-sep      { font-size:0.6rem; color:#333; }
  .prop-val      { font-size:0.72rem; font-weight:700; font-family:'SF Mono',monospace; flex:1; }
  .prop-type     { font-size:0.42rem; padding:1px 4px; border-radius:2px; background:#ffffff08; font-family:monospace; margin-left:auto; }
  .obj-empty     { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family:monospace; }

  /* Scalars */
  .scalars-card  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .scalars-hdr   { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .scalars-label { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .scalars-grid  { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:6px; padding:8px; }
  .sc-box        { background:#08080e; border:1px solid #1a1a2e; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px; transition:all 0.3s; }
  .sc-flash      { border-color:#c084fc44; background:#c084fc08; box-shadow:inset 3px 0 0 #c084fc; }
  .sc-hdr        { display:flex; justify-content:space-between; align-items:center; }
  .sc-name       { font-size:0.8rem; color:#e0e0e0; font-weight:700; font-family:'SF Mono',monospace; }
  .sc-type       { font-size:0.5rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#ffffff08; font-family:monospace; }
  .sc-val        { font-size:0.85rem; font-weight:700; font-family:'SF Mono',monospace; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
