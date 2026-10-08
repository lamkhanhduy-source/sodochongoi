const crypto = require('crypto');

const URL_ =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

const eq = (a, b) => {
  if (!a || !b) return false;

  const x = Buffer.from(a);
  const y = Buffer.from(b);

  return (
    x.length === y.length &&
    crypto.timingSafeEqual(x, y)
  );
};

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + TOKEN
    },
    body: JSON.stringify(cmd)
  });

  const j = await r.json();

  if (j.error) {
    throw new Error(j.error);
  }

  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (
    !process.env.EDIT_KEY ||
    !process.env.VIEW_KEY ||
    !URL_ ||
    !TOKEN
  ) {
    return res.status(500).json({
      error: 'missing_env'
    });
  }

  const key = String(
    req.headers['x-access-key'] || ''
  )
    .trim()
    .toUpperCase();

  const role = eq(
    key,
    process.env.EDIT_KEY.trim().toUpperCase()
  )
    ? 'edit'
    : eq(
        key,
        process.env.VIEW_KEY.trim().toUpperCase()
      )
    ? 'view'
    : null;

  if (!role) {
    return res.status(401).json({
      error: 'bad_key'
    });
  }

  try {
    // Kiểm tra 1 ghế hợp lệ
    const validSeat = (s) =>
      s &&
      Number.isInteger(s.c) &&
      Number.isInteger(s.r) &&
      typeof s.n === 'string' &&
      s.n.length < 80;

    // Mỗi sơ đồ gồm 234 ghế
    const validSeats = (a) =>
      Array.isArray(a) &&
      a.length === 234 &&
      a.every(validSeat);

    // =========================
    // GET - Lấy dữ liệu
    // =========================
    if (req.method === 'GET') {
      const v = await redis([
        'GET',
        'seating:main'
      ]);

      const d = v ? JSON.parse(v) : {};

      /*
       * Tương thích dữ liệu cũ:
       *
       * Dữ liệu cũ:
       * {
       *   seats: [...]
       * }
       *
       * sẽ được xem là Đợt 1.
       *
       * Dữ liệu mới:
       * {
       *   rounds: [
       *     [...], // Đợt 1
       *     [...]  // Đợt 2
       *   ]
       * }
       */

      const rounds =
        Array.isArray(d.rounds) &&
        d.rounds.length === 2
          ? d.rounds
          : [
              d.seats || null,
              null
            ];

      return res.status(200).json({
        role,
        seats: rounds[0],
        rounds,
        at: d.at || 0
      });
    }

    // =========================
    // POST - Lưu dữ liệu
    // =========================
    if (req.method === 'POST') {
      if (role !== 'edit') {
        return res.status(403).json({
          error: 'read_only'
        });
      }

      const rounds =
        req.body && req.body.rounds;

      const seats =
        req.body && req.body.seats;

      // Kiểm tra dữ liệu 2 đợt
      const okRounds =
        Array.isArray(rounds) &&
        rounds.length === 2 &&
        rounds.every(validSeats);

      // Hỗ trợ format cũ chỉ gửi seats
      const okOld = validSeats(seats);

      if (!okRounds && !okOld) {
        return res.status(400).json({
          error: 'bad_data'
        });
      }

      /*
       * Nếu frontend gửi:
       *
       * rounds: [đợt1, đợt2]
       *
       * thì lưu cả 2.
       *
       * Nếu frontend cũ chỉ gửi:
       *
       * seats: [...]
       *
       * thì lưu thành Đợt 1.
       */

      const data = {
        rounds: okRounds
          ? rounds
          : [seats, null],

        at: Date.now()
      };

      await redis([
        'SET',
        'seating:main',
        JSON.stringify(data)
      ]);

      return res.status(200).json({
        ok: true,
        at: data.at
      });
    }

    return res.status(405).json({
      error: 'method'
    });

  } catch (e) {
    return res.status(500).json({
      error: 'server'
    });
  }
};