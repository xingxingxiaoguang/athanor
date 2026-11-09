import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {checkRepository} from './repository-guard.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(cwd,...args)=>execFileSync('git',['-c','user.name=Guard Test','-c','user.email=guard@localhost',...args],{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
function fixture(t) {
  const cwd=mkdtempSync(join(tmpdir(),'athanor-guard-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  git(cwd,'init','-q');writeFileSync(join(cwd,'README.md'),'Source only.\n');
  git(cwd,'add','.');git(cwd,'-c','core.hooksPath=/dev/null','commit','-qm','Clean base');
  const policy=JSON.parse(readFileSync(join(ROOT,'.repository-policy.json')));policy.cleanHistoryBase=git(cwd,'rev-parse','HEAD');policy.requiredFiles=['README.md','.repository-policy.json'];
  const write=(file,bytes)=>{mkdirSync(dirname(join(cwd,file)),{recursive:true});writeFileSync(join(cwd,file),bytes);};
  const savePolicy=()=>write('.repository-policy.json',JSON.stringify(policy,null,2)+'\n');
  const commit=message=>{git(cwd,'add','-A');git(cwd,'-c','core.hooksPath=/dev/null','commit','-qm',message);return git(cwd,'rev-parse','HEAD');};
  savePolicy();commit('Enable policy');
  return {cwd,policy,write,savePolicy,commit,check:(mode='staged',refs)=>checkRepository({cwd,mode,...(refs?{refs}:{})})};
}
const has=(result,code,file)=>result.errors.some(e=>e.code===code&&(!file||e.file===file));

test('index bytes block forced outputs, renamed binaries and a clean/removed worktree disguise',t=>{
  const f=fixture(t);
  f.write('records/run/manifest.json','{}');git(f.cwd,'add','-f','records/run/manifest.json');rmSync(join(f.cwd,'records'),{recursive:true});
  f.write('docs/innocent.js',Buffer.from('PK\x03\x04archive'));git(f.cwd,'add','docs/innocent.js');f.write('docs/innocent.js','// Clean worktree; staged bytes are still an archive.\n');
  f.write('docs/image.txt',Buffer.from('GIF89a'));git(f.cwd,'add','docs/image.txt');
  f.write('demo/another.html','<!doctype html>');git(f.cwd,'add','demo/another.html');
  const r=f.check();assert.equal(r.passed,false);assert(has(r,'GENERATED_OUTPUT','records/run/manifest.json'));assert(has(r,'CONTENT_TYPE','docs/innocent.js'));assert(has(r,'CONTENT_TYPE','docs/image.txt'));assert(has(r,'EXTRA_DEMO','demo/another.html'));
  assert(r.errors.every(e=>e.recovery));
});

test('real original PNGs/fonts pass; source links and fake resource bytes are rejected',t=>{
  const f=fixture(t);
  const png=readFileSync(join(ROOT,'experiments/vfx-lab/fixtures/png/gray1.png'));
  f.write('src/fx/example/_assets/chip.png',png);
  f.write('demo/fonts/original.woff2',readFileSync(join(ROOT,'demo/fonts/PatchPixel-Regular.woff2')));
  f.write('demo/index.html','<!doctype html>');git(f.cwd,'add','.');assert.equal(f.check().passed,true);
  f.write('docs/plain-text.md','PK is a normal text prefix, not a ZIP signature.');git(f.cwd,'add','.');assert.equal(f.check().passed,true);
  f.write('src/fx/example/_assets/fake.png',Buffer.from('PK\x03\x04zip disguised as source texture'));
  symlinkSync('README.md',join(f.cwd,'linked-source'));git(f.cwd,'add','.');
  const r=f.check();assert(has(r,'CONTENT_TYPE','src/fx/example/_assets/fake.png'));assert(has(r,'SOURCE_ENTRY_UNSUPPORTED','linked-source'));
});

test('required guard files cannot disappear, and main cannot be deleted or rewound',t=>{
  const f=fixture(t);git(f.cwd,'rm','.repository-policy.json');f.savePolicy();
  assert(has(f.check(),'REQUIRED_SOURCE_MISSING','.repository-policy.json'));
  const head=git(f.cwd,'rev-parse','HEAD'),zero='0'.repeat(40),check=input=>checkRepository({cwd:f.cwd,mode:'push',input});
  assert(has(check(`(delete) ${zero} refs/heads/main ${head}\n`),'PROTECTED_REF_DELETE'));
  assert(has(check(`refs/heads/main ${f.policy.cleanHistoryBase} refs/heads/main ${head}\n`),'PROTECTED_REF_NON_FF'));
  assert.equal(check(`(delete) ${zero} refs/heads/topic ${head}\n`).passed,true);
});

test('source/resource/report budgets and the flat evaluation boundary are enforced from the index policy',t=>{
  const f=fixture(t);
  f.write('docs/too-large.txt','x'.repeat(f.policy.maxSourceFileBytes+1));
  f.write('src/fx/example/_assets/too-large.png',Buffer.alloc(f.policy.maxResourceFileBytes+1));
  f.write('experiments/vfx-lab/evaluations/test/original-report.md','x'.repeat(f.policy.maxReportFileBytes+1));
  f.write('experiments/vfx-lab/evaluations/test/calls/request.json','{}');git(f.cwd,'add','.');
  // Weakening only the worktree policy cannot change the bytes/rules being committed.
  f.policy.maxSourceFileBytes=9*1024*1024;f.savePolicy();
  const r=f.check();assert(has(r,'FILE_BUDGET','docs/too-large.txt'));assert(has(r,'FILE_BUDGET','src/fx/example/_assets/too-large.png'));assert(has(r,'REPORT_BUDGET'));assert(has(r,'EVALUATION_LAYOUT'));
});

test('a clean tip cannot hide an add-then-delete commit, including a merged side branch',t=>{
  const f=fixture(t);const main=git(f.cwd,'symbolic-ref','--short','HEAD');
  git(f.cwd,'checkout','-qb','bad-side');f.write('output/export.zip','accidental export');const bad=f.commit('Accidental generated output');
  rmSync(join(f.cwd,'output'),{recursive:true});f.commit('Delete output at the tip');assert.equal(f.check().passed,true);
  let r=f.check('history');assert.equal(r.passed,false);assert(r.errors.some(e=>e.code==='GENERATED_OUTPUT'&&e.commit===bad));
  git(f.cwd,'checkout','-q',main);git(f.cwd,'-c','core.hooksPath=/dev/null','merge','-q','--no-ff','-m','Merge side history','bad-side');
  r=f.check('history');assert.equal(r.passed,false);assert(r.errors.some(e=>e.code==='GENERATED_OUTPUT'&&e.commit===bad));
});

test('old unrelated roots, missing baselines and total reachable history growth are blocked',t=>{
  const f=fixture(t),tree=git(f.cwd,'rev-parse','HEAD^{tree}');
  const orphan=git(f.cwd,'commit-tree',tree,'-m','Unrelated old history');
  assert(has(f.check('history',[orphan]),'UNCLEAN_HISTORY_BASE'));
  f.policy.maxHistoryBytes=100;f.savePolicy();assert(has(f.check('history'),'HISTORY_BUDGET'));
  f.policy.cleanHistoryBase='f'.repeat(40);f.savePolicy();assert(has(f.check('history'),'HISTORY_BASE_MISSING'));
});

test('installed hooks block an actual commit and local-remote push; custom hooks are preserved',t=>{
  const f=fixture(t);cpSync(join(ROOT,'.githooks'),join(f.cwd,'.githooks'),{recursive:true});
  for(const file of ['repository-guard.mjs','install-hooks.mjs'])f.write('tools/'+file,readFileSync(join(ROOT,'tools',file)));
  f.commit('Install guard sources');
  const install=()=>spawnSync(process.execPath,[join(f.cwd,'tools/install-hooks.mjs')],{cwd:f.cwd,env:{...process.env,CI:''},encoding:'utf8'});
  assert.equal(install().status,0);assert.equal(git(f.cwd,'config','--get','core.hooksPath'),'.githooks');assert.equal(git(f.cwd,'config','--get','athanor.guardNode'),process.execPath);
  f.write('records/accident.json','{}');git(f.cwd,'add','records/accident.json');
  const commit=spawnSync('git',['-c','user.name=Guard Test','-c','user.email=guard@localhost','commit','-m','Must be blocked'],{cwd:f.cwd,encoding:'utf8'});
  assert.notEqual(commit.status,0);assert.match(commit.stdout+commit.stderr,/GENERATED_OUTPUT/);
  // Simulate bypassing pre-commit, then deleting the artifact: pre-push still sees it.
  f.commit('Bypass commit hook');rmSync(join(f.cwd,'records'),{recursive:true});f.commit('Clean current tree');
  const remote=join(f.cwd,'..',f.cwd.split('/').at(-1)+'-remote.git');t.after(()=>rmSync(remote,{recursive:true,force:true}));git(f.cwd,'init','--bare','-q',remote);
  const push=spawnSync('git',['push',remote,'HEAD:refs/heads/main'],{cwd:f.cwd,encoding:'utf8'});
  assert.notEqual(push.status,0);assert.match(push.stdout+push.stderr,/GENERATED_OUTPUT/);assert.equal(git(remote,'for-each-ref','--format=%(refname)'), '');
  git(f.cwd,'config','--local','core.hooksPath','custom-hooks');const conflict=install();assert.equal(conflict.status,1);assert.equal(git(f.cwd,'config','--get','core.hooksPath'),'custom-hooks');
});
