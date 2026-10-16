-- Synthetic local identities only. Each test transaction is rolled back.
insert into auth.users values
 ('20000000-0000-0000-0000-000000000001','a@example.invalid'),
 ('30000000-0000-0000-0000-000000000001','b@example.invalid');
insert into profiles(id,display_name) select id,'Synthetic fixture' from auth.users where email in ('a@example.invalid','b@example.invalid');
insert into saved_stops(user_id,stop_id) select id,'osm-node-7759210731' from auth.users where email in ('a@example.invalid','b@example.invalid');
insert into reviews(id,user_id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit,note,created_at) values
 ('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','osm-node-7759210731',4,4,4,4,4,'low',true,'day','Synthetic A',now()-interval '3 days'),
 ('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','osm-node-7759210731',3,3,3,3,3,'low',true,'day','Synthetic B',now()-interval '3 days');
