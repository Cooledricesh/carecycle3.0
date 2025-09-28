import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xlhtmakvxbdjnpvtzdqh.supabase.co',
  'sb_secret__kzFJSadp0VZ_Lj6wvMQOQ_cIRctQMx'
);

const { data, error } = await supabase.rpc('get_filtered_schedules', {
  p_user_id: '00000000-0000-0000-0000-000000000000',
  p_show_all: true
});

if (error) {
  console.log('ERROR:', error.message);
  console.log('Code:', error.code);
} else {
  console.log('SUCCESS: Function returned', data?.length || 0, 'rows');
}
