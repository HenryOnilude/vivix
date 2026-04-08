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

  /** Simple hash to bucket: sum of char codes mod N_BUCKETS */
  function hashKey(key, buckets = 4) {
    return [...key].reduce((acc, c) => acc + c.charCodeAt(0), 0) % buckets;
  }

  /** Pre-compute bucket layout: returns array of { key, bucket, row } */
  function bucketLayout(keys) {
    const counts = [0, 0, 0, 0];
    return keys.slice(0, 8).map(key => {
      const b = hashKey(key);
      const row = counts[b]++;
      return { key, bucket: b, row };
    });
  }
</script>

<!-- ── ObjExplorer module ───────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  routeKey="objects"
  titlePrefix="obj"
  titleAccent="Explorer"
  subtitle="— Objects"
  desc="See how key-value pairs are stored in hash maps — O(1) access via hash buckets"
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
          <span class="obj-access-badge">access: O(1)</span>
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

  <!-- Hash map internals — shows bucket assignment for each object's keys -->
  {#snippet bottomPanel(sd)}
    {@const objs = Object.entries(sd.vars || {}).filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v))}
    {#if objs.length > 0}
      {#key sd}
        {#each objs as [objName, objVal]}
          {@const keys = Object.keys(objVal)}
          {#if keys.length > 0}
            <div class="hash-card">
              <div class="hash-hdr">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke={ACCENT} stroke-width="1" opacity="0.5"/>
                  <line x1="4" y1="1" x2="4" y2="11" stroke={ACCENT} stroke-width="0.5" opacity="0.3"/>
                  <line x1="8" y1="1" x2="8" y2="11" stroke={ACCENT} stroke-width="0.5" opacity="0.3"/>
                </svg>
                <span class="hash-title">HASH MAP — {objName}</span>
                <span class="hash-subtitle">Each key hashes to a bucket in O(1)</span>
              </div>

              {#key keys.join(',')}
                {@const layout = bucketLayout(keys)}
                {@const maxRow = Math.max(...layout.map(l => l.row), 0)}
                <svg viewBox="0 0 300 {Math.max(60, (maxRow + 1) * 18 + 40)}" class="hash-svg">
                  <!-- Bucket headers -->
                  {#each [0,1,2,3] as b}
                    {@const bx = 6 + b * 73}
                    <rect x={bx} y="4" width="66" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
                    <text x={bx + 33} y="15" text-anchor="middle" fill="#333" font-size="6" font-family="monospace">bucket {b}</text>
                  {/each}

                  <!-- Key pills dropped into buckets -->
                  {#each layout as item}
                    {@const bx  = 6 + item.bucket * 73}
                    {@const ky  = 26 + item.row * 18}
                    {@const isHL = sd.highlightKey === item.key && sd.highlight === objName}
                    <rect x={bx} y={ky} width="66" height="14" rx="2"
                      fill={isHL ? ACCENT + '25' : '#0d0d1a'}
                      stroke={isHL ? ACCENT : '#1a1a2e'}
                      stroke-width={isHL ? 1 : 0.5}/>
                    <text x={bx + 5} y={ky + 10} fill={isHL ? ACCENT : '#666'} font-size="6" font-family="monospace">"{item.key}"</text>
                    {#if isHL}
                      <text x={bx + 60} y={ky + 10} text-anchor="end" fill={ACCENT} font-size="5.5" font-family="monospace">← hit</text>
                    {/if}
                  {/each}

                <!-- Lookup arrows from key to bucket -->
                {#if sd.highlightKey && sd.highlight === objName && keys.includes(sd.highlightKey)}
                  {@const hk = sd.highlightKey}
                  {@const b = hashKey(hk)}
                  <text x="150" y={Math.max(60, Math.ceil(keys.length / 2) * 22 + 32)} text-anchor="middle"
                    fill={ACCENT} font-size="6.5" font-family="monospace">
                    hash("{hk}") → bucket {b} → O(1) lookup
                  </text>
                {:else}
                  <text x="150" y={Math.max(60, Math.ceil(keys.length / 2) * 22 + 32)} text-anchor="middle"
                    fill="#2a2a3e" font-size="6" font-family="monospace">
                    hash(key) → bucket index → O(1) access regardless of object size
                  </text>
                {/if}
                </svg>
              {/key}
            </div>
          {/if}
        {/each}
      {/key}
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
      <svg viewBox="0 0 400 220" class="ph-svg">
        <text x="96"  y="56" fill="rgba(192,132,252,0.80)" font-size="30" font-family="monospace" font-weight="700">{'{'}</text>
        <text x="116" y="82" fill="rgba(255,255,255,0.88)" font-size="16" font-family="monospace" font-weight="600">name: "Alice"</text>
        <text x="116" y="106" fill="rgba(255,255,255,0.88)" font-size="16" font-family="monospace" font-weight="600">age: 25</text>
        <text x="288" y="106" fill="rgba(192,132,252,0.80)" font-size="30" font-family="monospace" font-weight="700">{'}'}</text>
        <rect x="28"  y="130" width="76" height="30" rx="3" fill="rgba(192,132,252,0.06)" stroke="rgba(192,132,252,0.45)" stroke-width="1.5"/>
        <rect x="112" y="130" width="76" height="30" rx="3" fill="rgba(192,132,252,0.06)" stroke="rgba(192,132,252,0.45)" stroke-width="1.5"/>
        <rect x="196" y="130" width="76" height="30" rx="3" fill="rgba(192,132,252,0.06)" stroke="rgba(192,132,252,0.45)" stroke-width="1.5"/>
        <rect x="280" y="130" width="76" height="30" rx="3" fill="rgba(192,132,252,0.06)" stroke="rgba(192,132,252,0.45)" stroke-width="1.5"/>
        <text x="66"  y="150" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="12" font-family="monospace">bucket 0</text>
        <text x="150" y="150" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="12" font-family="monospace">bucket 1</text>
        <text x="234" y="150" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="12" font-family="monospace">bucket 2</text>
        <text x="318" y="150" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="12" font-family="monospace">bucket 3</text>
        <text x="200" y="196" text-anchor="middle" fill="rgba(192,132,252,0.70)" font-size="14" font-family="monospace" font-weight="600">key → hash → bucket → O(1)</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to see objects in action</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Object cards */
  .obj-card       { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .obj-card-hdr   { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .obj-card-title { font-size:0.65rem; color:#c084fc; font-family:'SF Mono',monospace; font-weight:700; }
  .obj-access-badge { font-size:0.45rem; color:#4ade80; background:#4ade8010; padding:1px 5px; border-radius:3px; border:1px solid #4ade8025; }
  .obj-card-count { margin-left:auto; font-size:0.5rem; color:#444; font-family:monospace; }
  .obj-props      { padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
  .obj-prop       { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:4px; background:#08080e; border:1px solid #1a1a2e; transition:all 0.3s; }
  .prop-hl        { border-color:#c084fc44; background:#c084fc08; box-shadow:inset 3px 0 0 #c084fc; }
  .prop-key       { font-size:0.7rem; color:#e0e0e0; font-family:'SF Mono',monospace; font-weight:600; }
  .prop-sep       { font-size:0.6rem; color:#333; }
  .prop-val       { font-size:0.72rem; font-weight:700; font-family:'SF Mono',monospace; flex:1; }
  .prop-type      { font-size:0.42rem; padding:1px 4px; border-radius:2px; background:#ffffff08; font-family:monospace; margin-left:auto; }
  .obj-empty      { font-size:0.6rem; color:#2a2a3e; padding:6px; font-family:monospace; }

  /* Hash map card */
  .hash-card      { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .hash-hdr       { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .hash-title     { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .hash-subtitle  { margin-left:auto; font-size:0.45rem; color:#333; font-family:monospace; }
  .hash-svg       { width:100%; height:auto; display:block; padding:4px 0 6px; }

  /* Scalars */
  .scalars-card  { background:var(--a11y-bg, #0a0a12); border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
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
  .ph-svg  { width:360px; height:auto; opacity:1; }
  .ph-text { font-size:0.78rem; color:rgba(255,255,255,0.45); text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
