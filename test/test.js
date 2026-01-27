import http from 'k6/http';
import { check, sleep } from 'k6';

// AGGRESSIVE STRESS TEST
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Warm up to 50 users
    { duration: '1m', target: 100 },    // Ramp to 100 users
    { duration: '1m', target: 200 },    // Push to 200 users
    { duration: '1m', target: 300 },    // Stress: 300 users
    { duration: '1m', target: 500 },    // Heavy stress: 500 users
    { duration: '1m', target: 1000 },   // EXTREME: 1000 users
    { duration: '2m', target: 1000 },   // Hold at 1000 to see if it survives
    { duration: '1m', target: 0 },      // Ramp down
  ],
  
  thresholds: {
    http_req_failed: ['rate<0.1'],       // Allow 10% errors under stress
    http_req_duration: ['p(95)<5000'],   // 95% under 5 seconds
  },
};

const BASE_URL = 'https://devqa-api.linkmykidz.com/api/v1';

export default function () {
  const params = {
    headers: {
      'x-tenant-id': 'core',
    },
  };

  const response = http.get(BASE_URL, params);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'status is not 500': (r) => r.status !== 500,
    'status is not 503': (r) => r.status !== 503,
    'response time < 1s': (r) => r.timings.duration < 1000,
    'response time < 3s': (r) => r.timings.duration < 3000,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  // Minimal sleep for maximum stress
  sleep(0.1);
}

export function handleSummary(data) {
  console.log('\n🔥 STRESS TEST RESULTS 🔥\n');
  console.log('Max Concurrent Users:', data.metrics.vus_max.values.max);
  console.log('Total Requests:', data.metrics.http_reqs.values.count);
  console.log('Requests/sec (peak):', data.metrics.http_reqs.values.rate.toFixed(2));
  console.log('Failed Requests:', (data.metrics.http_req_failed.values.rate * 100).toFixed(2) + '%');
  console.log('\nResponse Times:');
  console.log('  Average:', data.metrics.http_req_duration.values.avg.toFixed(2) + 'ms');
  console.log('  Median:', data.metrics.http_req_duration.values.med.toFixed(2) + 'ms');
  console.log('  P95:', data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms');
  console.log('  P99:', data.metrics.http_req_duration.values['p(99)'].toFixed(2) + 'ms');
  console.log('  Max:', data.metrics.http_req_duration.values.max.toFixed(2) + 'ms');
  
  return {
    'stdout': '',
  };
}