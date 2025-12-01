// Tarih formatını test et

function formatDateForMSSQL(date) {
  if (!date) return null;
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Test 1: Normal tarih
const date1 = new Date();
console.log('Test 1 - Normal tarih:', formatDateForMSSQL(date1));

// Test 2: NULL
console.log('Test 2 - NULL:', formatDateForMSSQL(null));

// Test 3: undefined
console.log('Test 3 - undefined:', formatDateForMSSQL(undefined));

// Test 4: String tarih
const date4 = '2025-12-01T12:00:00.000Z';
console.log('Test 4 - String tarih:', formatDateForMSSQL(date4));

// Test 5: PostgreSQL'den gelen tarih
const pgDate = new Date('2025-12-01T09:41:46.099Z');
console.log('Test 5 - PG tarih:', formatDateForMSSQL(pgDate));
