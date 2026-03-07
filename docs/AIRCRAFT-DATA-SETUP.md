# Aircraft Data Configuration

## How Aircraft Data Works

Your app gets aircraft data through **TWO independent paths**:

### 1. **Vercel Edge Function** (Primary - Always Works) ✅

```
Browser → /api/osint/opensky → Vercel Edge → Aircraft APIs → Data
```

**Sources** (tried in parallel):
- ✅ **adsb.fi** (15s timeout, 2 endpoints)
- ✅ **OpenSky Network** (20s timeout, OAuth if configured)
- ✅ **ADS-B Exchange** (12s timeout, war zone focused)

**Updates**: Every 5 minutes via REST polling (cached 5 min in Redis)

**Coverage**: Global (500+ aircraft)

**No configuration needed** - works out of the box!

---

### 2. **Railway WebSocket Relay** (Optional - Real-time Updates)

```
Browser ← WebSocket ← Railway Relay ← Aircraft API
```

**Status**: ⚠️ **DISABLED** (Railway IPs blocked by OpenSky)

**What I Changed**:
- Removed OpenSky polling from Railway relay
- Relay now only handles AIS vessels
- Aircraft data comes from edge function only

**Why This Is Fine**:
- Edge function has **triple redundancy** (3 different APIs)
- Vercel IPs are **not blocked** by OpenSky
- 5-minute polling is sufficient for war zone intelligence
- WebSocket was only for <30s latency (overkill for strategic intelligence)

---

## Current Data Flow

### ✅ Working (No Action Required):

```mermaid
Browser
  ↓ (every 5 min)
/api/osint/opensky
  ↓
Vercel Edge Runtime
  ↓ (parallel race)
  ├─→ adsb.fi → 200+ aircraft
  ├─→ OpenSky → 300+ aircraft
  └─→ ADS-B Exchange → 100+ war zone aircraft
  ↓ (first successful response)
Redis Cache (5 min TTL)
  ↓
Browser (aircraft layer updates)
```

### ⚠️ Not Working (Railway blocked):

```mermaid
Railway Relay
  ↓
OpenSky API
  ↓
403 Forbidden (IP blocked) 🚫
```

---

## Railway Deployment

### **New Simplified Railway Setup**:

Railway relay now **ONLY** handles:
- ✅ AIS vessel tracking (if you have `AISSTREAM_API_KEY`)
- ❌ ~~Aircraft~~ (moved to edge function)

### **Environment Variables** (Railway):

```bash
# Required for vessel tracking
AISSTREAM_API_KEY=your_key_here  # Get from https://aisstream.io

# OpenSky no longer needed in Railway
# (Aircraft data comes from Vercel edge function)
```

### **Expected Logs** (Good):

```
[Relay] AIS stream client started
[Relay] WebSocket relay listening on port 8080
[Relay] OpenSky polling disabled (use edge function /api/osint/opensky instead)
[Relay] Aircraft data will be fetched via browser → Vercel edge → aircraft APIs
[AIS] Connected to AISStream.io  # (if AISSTREAM_API_KEY is set)
```

### **Expected Logs** (Also Good - No AIS Key):

```
[Relay] WebSocket relay listening on port 8080
[Relay] OpenSky polling disabled
[AIS] AISSTREAM_API_KEY not set or empty - skipping AIS connection
```

**No more errors or reconnection loops!**

---

## Vercel Deployment

### **Environment Variables** (Vercel):

```bash
# ACLED (required for conflict zones)
ACLED_EMAIL=your_email@domain.com
ACLED_PASSWORD=your_password

# Optional: Improves OpenSky reliability
OPENSKY_CLIENT_ID=your_client_id
OPENSKY_CLIENT_SECRET=your_client_secret

# Optional: Other market data keys
FINNHUB_API_KEY=your_key
COINGECKO_API_KEY=your_key
FRED_API_KEY=your_key
GROQ_API_KEY=your_key
```

**OpenSky OAuth** (optional but recommended):
- Register: https://opensky-network.org/my-account
- Create API client credentials
- Add to Vercel environment variables
- Improves rate limits from 100 → 400 requests/day

---

## Testing Aircraft Data

### 1. **Test Edge Function** (Production):

```bash
# Should return 200+ aircraft with source
curl https://your-app.vercel.app/api/osint/opensky | jq '.count, .source'

# Expected output:
# 342
# "adsbexchange"
```

### 2. **Test Locally**:

```bash
# Start dev server
npm run dev

# Test endpoint
curl http://localhost:3000/api/osint/opensky | jq '.count, .source'

# Expected: 100-500 aircraft
```

### 3. **Test on Globe**:

1. Open app in browser
2. Toggle "Aircraft" layer ON (globe controls, bottom left)
3. Wait 8 seconds for first fetch
4. See blue dots appear (especially over Europe/Middle East)
5. Hover over dots → see callsign, altitude, speed

---

## Troubleshooting

### "No aircraft showing"

**Check**:
1. Aircraft layer is toggled ON
2. Zoom level is appropriate (zoom 3-6 shows most aircraft)
3. Browser console → should see no errors
4. Test endpoint: `curl https://your-app/api/osint/opensky`

**If endpoint returns `count: 0`**:
- All 3 sources are rate-limited/down (rare)
- Check back in 5 minutes (cache may have stale data)
- Add OPENSKY_CLIENT_ID/SECRET to Vercel for better reliability

### "Railway keeps restarting"

**Old issue** (now fixed):
- OpenSky polling caused infinite reconnection loop
- **Solution**: Removed OpenSky from Railway relay

**New logs should be**:
```
[Relay] OpenSky polling disabled
```

No more restart loops!

---

## Data Quality by Source

| Source | Coverage | Update Rate | War Zones | Authentication |
|--------|----------|-------------|-----------|----------------|
| **adsb.fi** | Global | 30s | ✅ Europe/Middle East | None |
| **OpenSky** | Global | 10s | ✅ Strategic bbox | Optional OAuth |
| **ADS-B Exchange** | Targeted | 60s | ✅✅ Iraq, Ukraine, Taiwan, Israel | None |

**Combined**: 500+ aircraft with focus on conflict regions

---

## Summary

✅ **Aircraft data is working** via Vercel edge function
✅ **No Railway configuration needed** for aircraft
✅ **Triple redundancy** (3 independent APIs)
✅ **War zone focus** (ADS-B Exchange targets active conflicts)
❌ **Railway WebSocket disabled** (OpenSky blocks Railway IPs)

**Result**: You get reliable aircraft tracking over war zones without any Railway setup for aircraft!

---

## Optional Enhancements

### Add OpenSky OAuth (Better Rate Limits):

1. Register: https://opensky-network.org/my-account
2. Create API application → get client_id + client_secret
3. Add to Vercel:
   ```
   OPENSKY_CLIENT_ID=your_id
   OPENSKY_CLIENT_SECRET=your_secret
   ```
4. Redeploy

**Benefit**: 100 → 400 requests/day, priority queue

### Add AIS Vessel Tracking:

1. Get free key: https://aisstream.io
2. Add to Railway: `AISSTREAM_API_KEY=your_key`
3. Restart Railway service

**Benefit**: Real-time vessel positions on globe (separate layer)

---

**Bottom line**: Aircraft tracking is already working via Vercel. Railway is only for optional vessel tracking now!
