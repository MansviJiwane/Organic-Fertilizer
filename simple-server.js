const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// In-memory database
let users = [
  {
    id: 1,
    name: "Ram Kumar",
    phone: "+919876543210",
    role: "household",
    ecoscore: 85,
    totalWaste: 156.5,
    totalPoints: 1565,
    registeredAt: "2024-01-01"
  },
  {
    id: 2,
    name: "Sita Devi",
    phone: "+919876543211",
    role: "household",
    ecoscore: 92,
    totalWaste: 245.2,
    totalPoints: 2452,
    registeredAt: "2024-01-02"
  },
  {
    id: 3,
    name: "Ramesh Singh",
    phone: "+919876543212",
    role: "household",
    ecoscore: 78,
    totalWaste: 198.7,
    totalPoints: 1987,
    registeredAt: "2024-01-03"
  }
];

let wasteRecords = [
  { id: 1, userId: 1, location: "Dumping Point 1", amount: 12.5, type: "Kitchen Waste", date: "2024-01-15", points: 125 },
  { id: 2, userId: 1, location: "Dumping Point 2", amount: 8.2, type: "Garden Waste", date: "2024-01-14", points: 82 },
  { id: 3, userId: 2, location: "Dumping Point 1", amount: 15.3, type: "Mixed Organic", date: "2024-01-15", points: 153 },
  { id: 4, userId: 3, location: "Dumping Point 3", amount: 11.8, type: "Garden Waste", date: "2024-01-14", points: 118 }
];

// Store verification codes with operator info
let verificationCodes = [
  { code: "123456", operatorPhone: "+919960775814", createdAt: new Date().toISOString(), used: false },
  { code: "789012", operatorPhone: "+917028911914", createdAt: new Date().toISOString(), used: false }
];

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve static files
  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, 'index.html');
  } else if (pathname.endsWith('.html')) {
    serveFile(res, pathname.substring(1));
  } else if (pathname.endsWith('.css')) {
    serveFile(res, pathname.substring(1), 'text/css');
  } else if (pathname.endsWith('.js')) {
    serveFile(res, pathname.substring(1), 'application/javascript');
  }
  // API Routes
  else if (pathname === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: "Server is running", 
      timestamp: new Date().toISOString(),
      totalUsers: users.length 
    }));
  }
  else if (pathname === '/api/stats') {
    const totalKg = users.reduce((sum, user) => sum + user.totalWaste, 0);
    const topContributors = users
      .sort((a, b) => b.totalWaste - a.totalWaste)
      .slice(0, 3)
      .map(user => ({ name: user.name, kg: user.totalWaste }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      villages: 5,
      totalKg: Math.round(totalKg),
      topContributors
    }));
  }
  else if (pathname.startsWith('/api/user/') && method === 'GET') {
    const phone = pathname.split('/')[3];
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "User not found" }));
      return;
    }
    
    const userWasteHistory = wasteRecords
      .filter(record => record.userId === user.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const sortedUsers = users.sort((a, b) => b.totalWaste - a.totalWaste);
    const rank = sortedUsers.findIndex(u => u.id === user.id) + 1;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...user,
      rank,
      wasteHistory: userWasteHistory
    }));
  }
  else if (pathname === '/api/leaderboard') {
    const leaderboard = users
      .sort((a, b) => b.totalWaste - a.totalWaste)
      .map((user, index) => ({
        rank: index + 1,
        name: user.name,
        waste: user.totalWaste,
        ecoscore: user.ecoscore
      }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(leaderboard));
  }
  else if (pathname === '/api/register' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { name, phone, role = "household" } = JSON.parse(body);
        
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Please enter a valid name (at least 2 characters)" }));
          return;
        }
        
        if (!phone || typeof phone !== 'string' || phone.trim().length < 10) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Please enter a valid phone number (at least 10 digits)" }));
          return;
        }
        
        const validRoles = ['household', 'farmer', 'buyer', 'krushikendra', 'admin', 'truck_driver', 'compost_operator', 'dumping_manager'];
        if (!validRoles.includes(role)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Invalid role selected" }));
          return;
        }
        
        const cleanPhone = phone.trim();
        
        if (users.find(u => u.phone === cleanPhone)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "User with this phone number already exists" }));
          return;
        }
        
        const newUser = {
          id: users.length + 1,
          name: name.trim(),
          phone: cleanPhone,
          role,
          ecoscore: 0,
          totalWaste: 0,
          totalPoints: 0,
          registeredAt: new Date().toISOString().split('T')[0]
        };
        
        users.push(newUser);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user: newUser }));
        
      } catch (error) {
        console.error("Registration error:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Internal server error. Please try again." }));
      }
    });
  }
  else if (pathname === '/api/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(users));
  }
  else if (pathname === '/api/user-stats') {
    const roleStats = {};
    users.forEach(user => {
      roleStats[user.role] = (roleStats[user.role] || 0) + 1;
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalUsers: users.length,
      roleStats,
      recentRegistrations: users
        .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
        .slice(0, 5)
    }));
  }
  
  // ** Fixed /api/generate-code endpoint **
  else if (pathname === '/api/generate-code' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        console.log('Raw request body:', body);
        const data = JSON.parse(body);
        const operatorPhone = data.operatorPhone;

        if (!operatorPhone || typeof operatorPhone !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Operator phone number required and must be a string" }));
          return;
        }

        // Normalize phone number to +91 format if needed
        const normalizePhone = (phone) => {
          phone = phone.trim();
          if (phone.startsWith('+')) return phone;
          if (/^\d{10}$/.test(phone)) return '+91' + phone;
          return phone;
        };

        const normalizedOperatorPhone = normalizePhone(operatorPhone);

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Store verification code
        verificationCodes.push({
          code: code,
          operatorPhone: normalizedOperatorPhone,
          createdAt: new Date().toISOString(),
          used: false
        });

        console.log(`Generated verification code ${code} for operator ${normalizedOperatorPhone}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, code: code }));

      } catch (error) {
        console.error("Generate code error:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Internal server error: " + error.message }));
      }
    });
  }
  else if (pathname === '/api/verify-code' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { code, operatorPhone } = JSON.parse(body);
        
        if (!code || !operatorPhone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Code and operator phone required" }));
          return;
        }
        
        const verification = verificationCodes.find(v => 
          v.code === code && 
          v.operatorPhone === operatorPhone && 
          !v.used
        );
        
        if (!verification) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Invalid or already used verification code" }));
          return;
        }
        
        verification.used = true;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, valid: true }));
        
      } catch (error) {
        console.error("Verify code error:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  }
  else if (pathname === '/api/waste' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { userId, location, amount, type, verification, operatorPhone } = JSON.parse(body);
        
        if (!userId || !location || !amount || !type || !verification || !operatorPhone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Missing required fields including verification code and operator phone" }));
          return;
        }
        
        const verificationRecord = verificationCodes.find(v => 
          v.code === verification && 
          v.operatorPhone === operatorPhone && 
          !v.used
        );
        
        if (!verificationRecord) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Invalid verification code or operator phone. Please get a valid code from the dumping point operator." }));
          return;
        }
        
        verificationRecord.used = true;
        
        const points = Math.round(amount * 10);
        const newRecord = {
          id: wasteRecords.length + 1,
          userId: parseInt(userId),
          location,
          amount: parseFloat(amount),
          type,
          date: new Date().toISOString().split('T')[0],
          points
        };
        
        wasteRecords.push(newRecord);
        
        const user = users.find(u => u.id === parseInt(userId));
        if (user) {
          user.totalWaste += parseFloat(amount);
          user.totalPoints += points;
          user.ecoscore = Math.min(100, user.ecoscore + Math.floor(amount / 10));
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, record: newRecord }));
        
      } catch (error) {
        console.error("Add waste error:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Internal server error. Please try again." }));
      }
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Page Not Found</h1>');
  }
});

function serveFile(res, filename, contentType = 'text/html') {
  const filePath = path.join(__dirname, filename);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Total users: ${users.length}`);
  console.log(`🌱 Ecogaon - Waste to Wealth Platform`);
});
else if (pathname === '/api/generate-code' && method === 'POST') {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      console.log('Raw request body:', body);
      const data = JSON.parse(body);
      const operatorPhone = data.operatorPhone;

      if (!operatorPhone || typeof operatorPhone !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Operator phone number required and must be a string" }));
        return;
      }

      // Phone normalization function: add +91 if missing
      const normalizePhone = (phone) => {
        phone = phone.trim();
        if (phone.startsWith('+')) return phone;
        if (/^\d{10}$/.test(phone)) return '+91' + phone;
        return phone; // return as is if doesn't match, you can modify if needed
      };

      const normalizedOperatorPhone = normalizePhone(operatorPhone);
      console.log('Normalized operator phone:', normalizedOperatorPhone);

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Store verification code
      verificationCodes.push({
        code,
        operatorPhone: normalizedOperatorPhone,
        createdAt: new Date().toISOString(),
        used: false
      });

      console.log(`Generated verification code ${code} for operator ${normalizedOperatorPhone}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, code }));

    } catch (error) {
      console.error("Error generating code:", error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Internal server error: " + error.message }));
    }
  });
}
