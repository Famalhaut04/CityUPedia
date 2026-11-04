// Run with: node --test tools/test-progressive-loading.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const shared = fs.readFileSync(path.join(root, 'assets/shared.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ held = false, storage = {} } = {}) {
  const calls = [], pending = [], failOnce = new Set(), elements = new Map();
  let active = 0, maxActive = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', value: '', hidden: false, dataset: {},
      handlers: {}, classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      setAttribute() {}, insertAdjacentElement() {}, querySelector() { return null; }, querySelectorAll() { return []; }
    });
    return elements.get(id);
  }
  const ctx = {
    window: { addEventListener() {}, clearTimeout() {}, setTimeout() {}, location: { search: '', hash: '' } },
    document: { readyState: 'loading', addEventListener() {},
      getElementById: element, querySelector: element, querySelectorAll() { return []; },
      createElement() { return element(Symbol()); }, documentElement: {} },
    localStorage: { getItem: k => storage[k] ?? null, setItem: (k,v) => { storage[k] = v; } },
    console, setTimeout, clearTimeout, URLSearchParams,
    getComputedStyle: () => ({ getPropertyValue: () => '60' }),
    fetch: url => new Promise((resolve, reject) => {
      calls.push(url); active++; maxActive = Math.max(maxActive, active);
      const finish = () => {
        active--;
        if (failOnce.delete(url)) { reject(new Error('simulated network error')); return; }
        try { const value = JSON.parse(fs.readFileSync(path.join(root,url),'utf8')); resolve({ ok: true, json: async () => value }); }
        catch(error) { reject(error); }
      };
      if (held && url !== 'data/courses/index.json') pending.push(finish); else finish();
    })
  };
  vm.createContext(ctx); vm.runInContext(shared,ctx);
  ctx.MSDS = ctx.window.MSDS;
  return {ctx, calls, pending, failOnce, elements, storage, element,
    get maxActive() { return maxActive; },
    async release() { while(pending.length) { pending.splice(0).forEach(fn => fn()); await tick(); } }
  };
}

test('catalogue is usable after one request, with no detail fan-out', async () => {
  const h = harness({held:true}), m=h.ctx.MSDS;
  const data=await m.loadCourseData();
  assert.equal(data.programmes.length,68); assert.equal(data.courses.length,1119);
  assert.deepEqual(h.calls,['data/courses/index.json']);
  const programme=data.courses.filter(c=>c.programmes.includes('MSDS'));
  const loading=m.loadCourseDetails(programme.map(c=>c.code)); await tick();
  assert.equal(h.pending.length,8); assert.ok(programme.some(c=>!c.sections_loaded));
  await h.release(); await loading;
  assert.ok(programme.every(c=>c.sections_loaded && c.reviews_loaded));
  assert.ok(h.calls.every(url=>!url.includes('source-reviews')));
  const count=h.calls.length; await m.loadCourseDetails(programme.map(c=>c.code));
  assert.equal(h.calls.length,count); assert.ok(h.maxActive<=8);
  console.log(`Default programme: ${count} data requests, catalogue ready after 1 (previously 2328).`);
});

test('single-course details load only that course and its cited sources', async () => {
  const h=harness(), m=h.ctx.MSDS;
  const data=await m.loadCourseDetails(['CS6493'],{sources:true});
  assert.equal(data.courses.find(c=>c.code==='CS6493').eligible_sections[0].crn,'15350');
  const resources=h.calls.filter(url=>/^data\/(sections|reviews)\//.test(url));
  assert.deepEqual(resources.sort(),['data/reviews/CS6493.json','data/sections/CS6493.json']);
  const rec=data.courses.find(c=>c.code==='CS6493').recommendation;
  const ids=rec.source_ids || rec.sourceIds || [];
  assert.equal(h.calls.filter(url=>url.includes('source-reviews')).length,ids.length);
});

test('cited excerpts are retained without fetching unrelated sources', async () => {
  const h=harness(),m=h.ctx.MSDS;
  const data=await m.loadCourseDetails(['CS5487'],{sources:true});
  const course=data.courses.find(c=>c.code==='CS5487');
  assert.ok(course.recommendation.source_ids.length>0);
  const expected=course.recommendation.source_ids.map(id=>`data/source-reviews/${id}.json`).sort();
  assert.deepEqual(h.calls.filter(url=>url.includes('source-reviews')).sort(),Array.from(expected));
  assert.ok(data.sourceReviews.cityu_cs_guide.course_reviews.CS5487);
});

test('overlapping calls deduplicate and a failed resource can be retried', async () => {
  const h=harness({held:true}),m=h.ctx.MSDS;
  const url='data/sections/CS6493.json';h.failOnce.add(url);
  const a=m.loadCourseDetails(['CS6493']),b=m.loadCourseDetails(['CS6493']);
  const results=Promise.allSettled([a,b]);await tick();await h.release();
  assert.ok((await results).every(r=>r.status==='rejected'));
  assert.equal(h.calls.filter(u=>u===url).length,1);
  const data=await m.loadCourseData();assert.equal(data.courses.find(c=>c.code==='CS6493').sections_loaded,false);
  const retry=m.loadCourseDetails(['CS6493']);await tick();await h.release();await retry;
  assert.equal(h.calls.filter(u=>u===url).length,2);
  assert.equal(h.calls.filter(u=>u==='data/reviews/CS6493.json').length,1);
});

test('reviews-only views do not request sections; empty sections need no file', async () => {
  const h=harness(),m=h.ctx.MSDS;
  const data=await m.loadCourseData();
  const empty=data.courses.find(c=>c.section_count===0);
  await m.loadCourseDetails(['CS6493'],{sections:false});
  assert.ok(!h.calls.some(url=>url.includes('/sections/')));
  await m.loadCourseDetails([empty.code],{reviews:false});
  assert.ok(!h.calls.some(url=>url.includes('/sections/')));
});

test('planner fills selectors while details are delayed and preserves saved selections', async () => {
  const stored={MSDS:{SemA:{DSC8007:{primaryCrn:'14195',tutorialCrn:null}},SemB:{},Summer:{}}};
  const storage={'CITYU-current-programme':'MSDS','CITYU-planner-selections-v3':JSON.stringify(stored)};
  const h=harness({held:true,storage}),m=h.ctx.MSDS;
  m.createSearchSelect=(slot,config)=>{
    const control={options:[],config,setValue(){},setOptions(options){this.options=options;}};
    slot.control=control;return control;
  };
  vm.runInContext(fs.readFileSync(path.join(root,'assets/planner.js'),'utf8'),h.ctx);
  await tick();
  assert.ok(h.element('college-select').control.options.length>0);
  assert.ok(h.element('programme-select').control.options.length>0);
  assert.match(h.element('course-list').innerHTML,/班次加载中/);
  assert.match(h.element('selected-list').innerHTML,/班次加载中/);
  assert.equal(h.element('export-pdf').disabled,true);
  assert.equal(JSON.parse(storage['CITYU-planner-selections-v3']).MSDS.SemA.DSC8007.primaryCrn,'14195');
  await h.release();
  assert.ok(!h.element('course-list').innerHTML.includes('班次加载中'));
  assert.equal(h.element('export-pdf').disabled,false);
  assert.equal(JSON.parse(storage['CITYU-planner-selections-v3']).MSDS.SemA.DSC8007.primaryCrn,'14195');
});

test('catalogue failure resets the request so navigation can retry', async () => {
  const h=harness(),m=h.ctx.MSDS;
  h.failOnce.add('data/courses/index.json');
  await assert.rejects(m.loadCourseData(),/simulated/);
  const data=await m.loadCourseData();
  assert.equal(data.courses.length,1119);assert.equal(h.calls.length,2);
});

test('completed courses become usable while another course is still pending', async () => {
  const h=harness({held:true}),m=h.ctx.MSDS,progress=[];
  let complete=false;
  const loading=m.loadCourseDetails(['CS6493','CS6535'],{onProgress:course=>progress.push(course.code)}).then(()=>{complete=true;});
  await tick();
  // Resolve only CS6493's sections; its review and the other course remain delayed.
  h.pending.shift()();await tick();
  assert.equal(complete,false);assert.ok(progress.includes('CS6493'));
  const data=await m.loadCourseData();
  assert.equal(data.courses.find(c=>c.code==='CS6493').sections_loaded,true);
  assert.equal(data.courses.find(c=>c.code==='CS6535').sections_loaded,false);
  await h.release();await loading;
});

test('font stylesheets cannot block initial rendering and inline handlers parse', () => {
  for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html'))) {
    const html=fs.readFileSync(path.join(root,name),'utf8');
    for(const [tag] of html.matchAll(/<link[^>]+href="https:\/\/fonts.googleapis.com\/[^>]+>/g)) {
      assert.match(tag,/media="print"/);
      const handler=tag.match(/onload="([^"]+)"/)[1];
      const link={media:'print'};new Function(handler).call(link);assert.equal(link.media,'all');
    }
  }
});

test('fast programme changes prioritize new requests and cannot repaint the old view', async () => {
  const h=harness({held:true}),m=h.ctx.MSDS;
  m.createSearchSelect=(slot,config)=>{
    const control={options:[],config,setValue(){},setOptions(options){this.options=options;}};
    slot.control=control;return control;
  };
  vm.runInContext(fs.readFileSync(path.join(root,'assets/planner.js'),'utf8'),h.ctx);
  await tick();
  h.element('programme-select').control.config.onChange('MSCS');
  await tick();
  assert.match(h.element('programme-summary-name').textContent,/MSCS/);
  await h.release();
  const data=await m.loadCourseData();
  const codes=[...h.element('course-list').innerHTML.matchAll(/<span class="course-code">([^<]+)</g)].map(match=>match[1]);
  assert.ok(codes.length>0);
  assert.ok(codes.every(code=>data.courses.find(c=>c.code===code).programmes.includes('MSCS')));
  assert.match(h.element('programme-summary-name').textContent,/MSCS/);
  assert.ok(h.maxActive<=8);
});

test('full hydration preserves all course/section totals and corrected CRNs', async () => {
  const h=harness(),m=h.ctx.MSDS,data=await m.loadCourseData();
  await m.loadCourseDetails(data.courses.map(c=>c.code));
  assert.equal(data.courses.filter(c=>c.eligible_sections.length).length,619);
  for(const c of data.courses)assert.equal(c.eligible_sections.length,c.section_count,c.code);
  assert.equal(data.courses.find(c=>c.code==='CS6535').eligible_sections[0].crn,'11661');
});
