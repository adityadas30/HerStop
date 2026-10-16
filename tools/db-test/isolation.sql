-- CASE: A/B/anon row isolation and insert-as protection
do $$
declare actor text; target uuid; t text; col text; n int;
begin
 foreach actor in array array['20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',''] loop
  target := case when actor='30000000-0000-0000-0000-000000000001' then '20000000-0000-0000-0000-000000000001'::uuid else '30000000-0000-0000-0000-000000000001'::uuid end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',nullif(actor,''),'role',case when actor='' then 'anon' else 'authenticated' end)::text,true);
  if actor='' then set local role anon; else set local role authenticated; end if;
  foreach t in array array['profiles','saved_stops','reviews'] loop
   col := case when t='profiles' then 'id' else 'user_id' end;
   execute format('select count(*) from %I where %I=$1',t,col) into n using target;
   perform test.ok(n=0,t || ' cross read');
   begin
    execute format('update %I set %I=%I where %I=$1',t,col,col,col) using target;
    get diagnostics n=row_count; perform test.ok(n=0,t || ' cross update');
   exception when insufficient_privilege then
    perform test.ok(actor='' and t='reviews','only anon review policy helper denial is expected');
   end;
   execute format('delete from %I where %I=$1',t,col) using target;
   get diagnostics n=row_count; perform test.ok(n=0,t || ' cross delete');
  end loop;
  perform test.denied(format('insert into profiles(id) values (%L)',target));
  perform test.denied(format('insert into saved_stops(user_id,stop_id) values (%L,%L)',target,'osm-node-9446063174'));
  perform test.denied(format('insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit) values (%L,%L,3,3,3,3,3,''low'',true,''day'')',target,'osm-node-9446063174'));
  if actor<>'' then
   perform test.ok((select count(*)=1 from profiles),'own profile readable');
   perform test.ok((select count(*)=1 from saved_stops),'own save readable');
   perform test.ok((select count(*)=1 from reviews),'own review readable');
  end if;
  reset role;
 end loop;
 perform test.ok((select count(*)=2 from profiles),'cross mutations did not change profiles');
 perform test.ok((select count(*)=2 from saved_stops),'cross mutations did not change saves');
 perform test.ok((select count(*)=2 from reviews),'cross mutations did not change reviews');
end $$;
-- CASE: Own operations and review invariant trigger
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update profiles set display_name='Own edit';
select test.ok((select display_name='Own edit' from profiles),'own profile edit');
with d as (delete from profiles returning *) select test.ok((select count(*)=0 from d),'profile delete has no policy');
with u as (update saved_stops set stop_id='osm-node-9446063174' returning *) select test.ok((select count(*)=0 from u),'save update has no policy');
delete from saved_stops;
insert into saved_stops(user_id,stop_id) values (auth.uid(),'osm-node-9446063174');
update reviews set user_id='30000000-0000-0000-0000-000000000001',stop_id='osm-node-9446063174',created_at='2000-01-01',is_hidden=true,note='Own edit';
select test.ok((select user_id=auth.uid() and stop_id='osm-node-7759210731' and created_at>'2000-01-02' and not is_hidden and note='Own edit' from reviews),'pinned invariants');
delete from reviews;
insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit,created_at,is_hidden)
values (auth.uid(),'osm-node-7759210731',3,3,3,3,3,'low',true,'day','2000-01-01',true);
select test.ok((select created_at=now() and not is_hidden from reviews),'insert timestamp and moderation forced');
-- CASE: Public projection, delay boundary and day timing oracle (KNOWN RISK)
update reviews set created_at=date_trunc('day',now()-review_publish_delay()) where user_id='20000000-0000-0000-0000-000000000001';
update reviews set created_at=date_trunc('day',now()-review_publish_delay())-interval '1 microsecond' where user_id='30000000-0000-0000-0000-000000000001';
set local role anon;
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731')),'strict daily threshold');
select test.ok((select bool_and(not (to_jsonb(r) ?| array['user_id','created_at'])) from get_stop_reviews('osm-node-7759210731') r),'no author or timestamp in projection');
select test.ok((select review_count=1 from get_stop_review_stats(array['osm-node-7759210731'])),'stats reveal which side of UTC day boundary');
reset role;
select test.ok((select review_publish_delay()=interval '24 hours'),'configured delay');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.ok((select count(*)=2 from get_stop_reviews('osm-node-7759210731')),'author sees own new review');
-- CASE: [baseline-only] B1 already-public edit becomes public immediately (KNOWN RISK)
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update reviews set note='Synthetic immediate public edit' where user_id=auth.uid();
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731') where note='Synthetic immediate public edit'),'B1 reproduced: no edit reporting window');
-- CASE: Moderation RPC permissions, idempotence, scoped hiding and evidence
set local role anon;
select test.denied($q$select report_review('20000000-0000-0000-0000-000000000002','spam')$q$);
select test.denied($q$select hide_review('20000000-0000-0000-0000-000000000002')$q$);
select test.denied($q$select is_banned('20000000-0000-0000-0000-000000000001')$q$);
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select report_review('20000000-0000-0000-0000-000000000002','spam');
select report_review('20000000-0000-0000-0000-000000000002','spam');
select hide_review('20000000-0000-0000-0000-000000000002');
select hide_review('20000000-0000-0000-0000-000000000002');
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731')),'personal hide affects B');
select test.ok((select review_count=2 from get_stop_review_stats(array['osm-node-7759210731'])),'personal hide does not affect stats');
select test.ok(test.no_rows_visible('review_reports'),'reports cannot be read directly');
select test.ok(test.no_rows_visible('hidden_reviews'),'hides cannot be read directly');
reset role;
select test.ok((select count(*)=1 from hidden_reviews),'hide idempotent');
select test.ok((select count(*)=1 and min(review_note_snapshot)='Synthetic A' from review_reports),'report idempotent and snapshots note');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.ok((select count(*)=2 from get_stop_reviews('osm-node-7759210731')),'B hide does not hide from A');
-- CASE: New, globally hidden and banned-author reviews deny other-viewer RPCs
do $$
declare mode text;
begin
 foreach mode in array array['new','hidden','banned'] loop
  reset role;
  update reviews set created_at=case when mode='new' then now() else now()-interval '3 days' end,is_hidden=(mode='hidden') where user_id='20000000-0000-0000-0000-000000000001';
  if mode='banned' then insert into banned_users(user_id) values ('20000000-0000-0000-0000-000000000001'); end if;
  perform set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  set local role authenticated;
  perform test.denied($q$select report_review('20000000-0000-0000-0000-000000000002','spam')$q$,'P0001');
  perform test.denied($q$select hide_review('20000000-0000-0000-0000-000000000002')$q$,'P0001');
  perform test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731')),'excluded from B read');
  perform test.ok((select review_count=1 from get_stop_review_stats(array['osm-node-7759210731'])),'excluded from aggregate');
 end loop;
end $$;
-- CASE: Hidden author cannot unhide/delete; banned author cannot write
update reviews set is_hidden=true where user_id='20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update reviews set is_hidden=false;
select test.ok((select is_hidden from reviews),'cannot unhide');
with d as (delete from reviews returning *) select test.ok((select count(*)=0 from d),'cannot delete moderated review');
select test.ok((select count(*)=2 from get_stop_reviews('osm-node-7759210731')),'hidden author still sees own');
reset role;
insert into banned_users(user_id) values ('20000000-0000-0000-0000-000000000001');
set local role authenticated;
select test.denied($q$update reviews set note='banned edit'$q$);
select test.denied($q$insert into reviews(user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit) values (auth.uid(),'osm-node-9446063174',3,3,3,3,3,'low',true,'day')$q$);
select test.ok((select count(*)=1 from get_stop_reviews('osm-node-7759210731')),'banned own review absent from RPC');
-- CASE: [baseline-only] Arbitrary UUID ban oracle and banned caller moderation (KNOWN RISKS)
insert into banned_users(user_id) values ('30000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select test.ok(is_banned('30000000-0000-0000-0000-000000000001'),'A learns B ban status');
select test.ok(not is_banned('40000000-0000-0000-0000-000000000001'),'arbitrary absent UUID returns false');
reset role;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select report_review('20000000-0000-0000-0000-000000000002','spam');
select hide_review('20000000-0000-0000-0000-000000000002');
reset role;
select test.ok((select count(*)=1 from review_reports),'banned caller CAN report');
select test.ok((select count(*)=1 from hidden_reviews),'banned caller CAN hide');
-- CASE: [baseline-only] TRUNCATE bypasses RLS under simulated broad grants (KNOWN CONDITIONAL RISK)
insert into banned_users(user_id) values ('20000000-0000-0000-0000-000000000001');
set local role anon;
truncate table banned_users;
reset role;
select test.ok((select count(*)=0 from banned_users),'TRUNCATE is not subject to RLS');
-- CASE: [baseline-only] Revoke-from-PUBLIC leaves explicit default EXECUTE grants (KNOWN CONDITIONAL RISK)
select test.ok(has_function_privilege('anon','review_publish_delay()','execute'),'anon keeps review_publish_delay under broad default grants');
select test.ok(has_function_privilege('authenticated','reviews_enforce_invariants()','execute'),'clients keep trigger-function execute');
select test.ok(has_function_privilege('authenticated','is_banned(uuid)','execute'),'authenticated can call arbitrary-UUID is_banned');
-- CASE: 007 privileges, caller deletion and all FK cascades
select test.ok(has_function_privilege('authenticated','delete_my_account()','execute'),'authenticated grant');
select test.ok(not has_function_privilege('anon','delete_my_account()','execute'),'anon revoked');
select test.ok((select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='delete_my_account()'::regprocedure),'definer and empty search path');
set local role anon;
select test.denied('select delete_my_account()');
reset role;
insert into hidden_reviews(user_id,review_id) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
insert into review_reports(review_id,reporter_id,reason) values
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','spam'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','spam');
insert into banned_users(user_id) values ('20000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select delete_my_account();
reset role;
select test.ok((select count(*)=0 from auth.users where id='20000000-0000-0000-0000-000000000001'),'A auth gone');
select test.ok((select count(*)=1 from auth.users where id='30000000-0000-0000-0000-000000000001'),'B auth retained');
select test.ok((select count(*)=1 from profiles),'only B profile');
select test.ok((select count(*)=1 from saved_stops),'only B save');
select test.ok((select count(*)=1 from reviews),'only B review');
select test.ok((select count(*)=0 from review_reports),'reports ABOUT A and BY A gone');
select test.ok((select count(*)=0 from hidden_reviews),'hides ABOUT A and BY A gone');
select test.ok((select count(*)=0 from banned_users),'A ban gone');
select test.ok((select count(*)=44 from stops),'stops retained');
-- CASE: Stop removal cascades into saves, reviews, hides and reports
insert into hidden_reviews(user_id,review_id) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
insert into review_reports(review_id,reporter_id,reason) values ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','spam');
delete from stops where id='osm-node-7759210731';
select test.ok((select count(*)=0 from saved_stops),'saves cascade');
select test.ok((select count(*)=0 from reviews),'reviews cascade');
select test.ok((select count(*)=0 from hidden_reviews),'hides cascade');
select test.ok((select count(*)=0 from review_reports),'reports cascade');
