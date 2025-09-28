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
} else {
  console.log('Total schedules:', data.length);
  const statuses = {};
  data.forEach(s => {
    statuses[s.status] = (statuses[s.status] || 0) + 1;
  });
  console.log('Status breakdown:', statuses);
  
  // Check for completed
  const completed = data.filter(s => s.status === 'completed');
  console.log('Completed schedules:', completed.length);
}
