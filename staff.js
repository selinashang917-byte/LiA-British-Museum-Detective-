// Staff area: sign in with the shared staff password, view every team live, delete teams.
let staffOrigin='welcome',staffUnsub=null,staffRuns=[],staffSignedIn=false,staffAuthUnsub=null;
const staffBackend=()=>import('./firebase.js');
const staffTime=t=>t?new Date(t).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).replace(',',''):'—';

function staffVisible(){const c=$('staffCentre').value,f=$('staffStatusFilter').value;return staffRuns.filter(r=>(!c||String(r.cohort||'').trim().toLowerCase()===c)&&(!f||(f==='done'?r.completed:!r.completed)))}

function staffRender(){
 const centres=[...new Map(staffRuns.filter(r=>String(r.cohort||'').trim()).map(r=>[String(r.cohort).trim().toLowerCase(),String(r.cohort).trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
 const sel=$('staffCentre'),keep=sel.value;
 sel.innerHTML='<option value="">All centres</option>'+centres.map(([k,v])=>`<option value="${escapeHtml(k)}">${escapeHtml(v)}</option>`).join('');
 if(centres.some(([k])=>k===keep))sel.value=keep;
 const rows=staffVisible();
 $('staffRows').innerHTML=rows.map(r=>`<tr><td><button class="btn danger small" type="button" data-del="${r.id}" aria-label="Delete ${escapeHtml(r.team)}">Delete</button></td><td>${escapeHtml(r.team)}</td><td>${escapeHtml(r.cohort||'—')}</td><td>${staffTime(r.startedAt)}</td><td><span class="tag ${r.completed?'done':''}">${r.completed?'Finished':'In progress'}</span></td><td>${r.completed?r.score+' / 14':'—'}</td><td>${r.completed?formatTime(r.durationSeconds):'—'}</td></tr>`).join('');
 const done=rows.filter(r=>r.completed).length;
 $('staffStatus').textContent=rows.length?`${rows.length} team${rows.length===1?'':'s'} shown · ${done} finished · ${rows.length-done} in progress · live`:'No teams match.';
 $('staffDeleteShown').disabled=!rows.length;
 document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const r=staffRuns.find(x=>x.id===b.dataset.del);if(r)staffDelete([r.id],`Delete team “${r.team}”${r.cohort?' ('+r.cohort+')':''}? This cannot be undone.`)});
}

async function staffDelete(ids,question){
 if(!ids.length||!confirm(question))return;
 $('staffStatus').textContent='Deleting…';
 try{const fb=await staffBackend();await fb.deleteRuns(ids);$('staffStatus').textContent=`Deleted ${ids.length} team${ids.length===1?'':'s'}.`}
 catch(e){$('staffStatus').textContent='Could not delete. '+(e.code&&e.code.includes('permission')?'Your staff sign-in was not accepted.':e.message)}
}

function staffShowState(signedIn){
 staffSignedIn=signedIn;$('staffBtn').classList.toggle('on',signedIn);$('staffBtn').textContent=signedIn?'✓ Staff':'🔒 Staff';
 $('staffLogin').classList.toggle('hide',signedIn);$('staffArea').classList.toggle('hide',!signedIn);
 if(staffUnsub){staffUnsub();staffUnsub=null}
 if(signedIn&&!$('staffScreen').classList.contains('hide'))staffWatch();
}

async function staffWatch(){
 if(staffUnsub)return;$('staffStatus').textContent='Loading teams…';
 try{const fb=await staffBackend();staffUnsub=fb.watchAllRuns(runs=>{staffRuns=runs;staffRender()},e=>{$('staffStatus').textContent='Could not load teams. Check your internet connection.'})}
 catch(e){$('staffStatus').textContent='Could not load teams. '+e.message}
}

async function openStaff(){
 staffOrigin=['welcome','play','finish','mapScreen','leaderboard'].find(id=>!$(id).classList.contains('hide'))||'welcome';
 if(typeof stopWatching==='function'&&staffOrigin==='leaderboard'){rankingRequest++;stopWatching()}
 show('staffScreen');$('staffScreen').scrollIntoView({block:'start'});$('staffLoginStatus').textContent='';
 try{const fb=await staffBackend();if(!staffAuthUnsub)staffAuthUnsub=fb.onStaffChange(staffShowState);if(staffSignedIn)staffWatch();else $('staffPassword').focus()}
 catch(e){$('staffLoginStatus').textContent='Staff area needs an internet connection. '+e.message}
}

async function staffSignInClick(){
 const pw=$('staffPassword').value;if(!pw){$('staffLoginStatus').textContent='Enter the staff password.';return}
 $('staffSignIn').disabled=true;$('staffLoginStatus').textContent='Signing in…';
 try{const fb=await staffBackend();await fb.staffSignIn(pw);$('staffPassword').value='';$('staffLoginStatus').textContent='';staffWatch()}
 catch(e){$('staffLoginStatus').textContent=e.message}
 finally{$('staffSignIn').disabled=false}
}

$('staffBtn').onclick=openStaff;
$('closeStaff').onclick=()=>{if(staffUnsub){staffUnsub();staffUnsub=null}if(staffOrigin==='leaderboard')openRankings(rankingOrigin);else{show(staffOrigin);if(staffOrigin==='play')render();if(staffOrigin==='finish'){showFinish();displayResult()}}};
$('staffSignIn').onclick=staffSignInClick;
$('staffPassword').onkeydown=e=>{if(e.key==='Enter')staffSignInClick()};
$('staffSignOut').onclick=async()=>{const fb=await staffBackend();await fb.staffSignOut();staffRuns=[];$('staffRows').innerHTML=''};
$('staffCentre').onchange=staffRender;$('staffStatusFilter').onchange=staffRender;
$('staffDeleteShown').onclick=()=>{const ids=staffVisible().map(r=>r.id);const c=$('staffCentre').selectedOptions[0].textContent;staffDelete(ids,`Delete all ${ids.length} team${ids.length===1?'':'s'} shown (${c})? They will be removed from the leaderboard permanently.`)};
