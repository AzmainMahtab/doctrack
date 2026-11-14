export const SLIDING_WINDOW = `
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
local window = tonumber(ARGV[1]) * 1000
local limit = tonumber(ARGV[2])
local mode = ARGV[3]
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
local oldest = now
if count > 0 then
  local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  oldest = tonumber(first[2])
end

if mode == 'peek' then
  local allowed = 0
  if count < limit then allowed = 1 end
  return { allowed, math.max(0, limit - count), math.ceil((oldest + window - now) / 1000) }
end

if mode == 'consume' and count >= limit then
  return { 0, 0, math.ceil((oldest + window - now) / 1000) }
end

redis.call('ZADD', KEYS[1], now, member)
redis.call('PEXPIRE', KEYS[1], window)
count = count + 1
if count == 1 then oldest = now end
local allowed = 1
if count > limit then allowed = 0 end
return { allowed, math.max(0, limit - count), math.ceil((oldest + window - now) / 1000) }
`;
