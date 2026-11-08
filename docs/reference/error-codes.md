# Error Codes

> **Machine-readable error codes returned by ReBites APIs**

---

## Error Response Format

```json
{
  "error": "Human-readable Indonesian message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}  // Optional additional context
}
```

---

## Authentication & Authorization

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `unauthorized` | 401 | Unauthorized. Silakan login ulang. | Missing/invalid Bearer token |
| `forbidden` | 403 | Tidak berhak mengakses/mengubah. | Role mismatch, inactive account |
| `super_admin_required` | 403 | Hanya super admin yang dapat melakukan aksi ini. | Role change, user deletion |
| `account_suspended` | 403 | Akun Anda ditangguhkan. | `account_status = 'suspended'` |
| `account_banned` | 403 | Akun Anda dibanned permanen. | `account_status = 'banned'` |

---

## Validation Errors

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `invalid_json` | 400 | Body harus JSON valid. | `req.json()` throws |
| `payload_incomplete` | 400 | Payload tidak lengkap. | Missing required fields |
| `quantity_invalid` | 400 | Quantity tidak valid. | Not integer 1-99 |
| `fulfillment_invalid` | 400 | fulfillment harus delivery atau pickup. | Not `delivery` or `pickup` |
| `address_invalid` | 400 | Alamat pengiriman tidak valid. | `sanitizeAddressSnapshot` failed |
| `address_not_found` | 404 | Alamat pengiriman tidak ditemukan. | Address ID not owned by user |
| `dest_coordinates_missing` | 400 | Koordinat alamat tujuan belum tersedia. | Address missing lat/lng |
| `origin_coordinates_missing` | 400 | Lokasi toko belum tersedia. | Seller hasn't set store location |
| `promo_invalid` | 400 | Kode promo tidak valid atau sudah berakhir. | Expired, used up, or inactive |
| `promo_not_applicable` | 400 | Promo tidak berlaku untuk pesanan ini. | Category/minimum not met |

---

## Resource Errors

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `not_found` | 404 | Resource tidak ditemukan. | Generic |
| `product_not_found` | 404 | Produk tidak ditemukan. | Slug doesn't exist |
| `product_unavailable` | 400 | Produk tidak tersedia untuk dipesan. | Stock 0, hidden, not approved, schedule |
| `product_no_delivery` | 400 | Produk ini tidak tersedia untuk diantar. | `is_delivery = false` |
| `product_no_pickup` | 400 | Produk ini tidak tersedia untuk diambil sendiri. | `is_pickup = false` |
| `product_not_scheduled` | 400 | Menu ini belum tayang atau jadwalnya sudah berakhir. | Outside `scheduled_start`/`end` |
| `order_not_found` | 404 | Pesanan tidak ditemukan. | Order code doesn't exist |
| `vendor_incomplete` | 500 | Data toko produk tidak lengkap. | Missing `umkm_id` on product |
| `store_not_found` | 404 | Toko tidak ditemukan. | UMKM slug not found |

---

## Business Logic Errors

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `insufficient_stock` | 400 | Stok tidak mencukupi. | Requested qty > available |
| `amount_mismatch` | 409 | Jumlah pembayaran tidak sesuai. | Xendit `paid_amount` ≠ order `total_price` |
| `already_paid` | 409 | Pesanan sudah dibayar. | Idempotent webhook replay |
| `rate_limited` | 429 | Terlalu banyak permintaan. Coba lagi dalam X detik. | `verifyThrottle` exceeded |
| `idempotency_conflict` | 409 | Permintaan duplikat dengan kunci yang sama. | Same idempotency key, different payload |
| `service_unavailable` | 503 | Layanan sedang tidak dapat dihubungi. | Supabase/Xendit/Biteship down |
| `server_misconfigured` | 500 | Server misconfigured. | Missing env var (webhook token) |

---

## Webhook Errors

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `invalid_callback_token` | 401 | Invalid callback token. | Xendit token mismatch |
| `invalid_signature` | 401 | Invalid signature. | Biteship HMAC mismatch |
| `missing_amount` | 400 | Missing amount. | Xendit webhook without amount |
| `order_not_found` | 200 | (Note in body) | Webhook for non-existent order |

---

## Payment & Shipping

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `xendit_error` | 502 | Gagal membuat invoice pembayaran. | Xendit API error |
| `biteship_error` | 502 | Gagal menghitung/membuat pengiriman. | Biteship API error |
| `provider_balance` | 503 | Saldo akun pengiriman tidak mencukupi. | Biteship balance low |
| `provider_quota` | 503 | Layanan ongkir dibatasi (kuota). | Biteship rate limited |

---

## AI Errors

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `ai_unavailable` | 503 | Layanan AI sedang tidak tersedia. | Gemini API down/timeout |
| `ai_quota_exceeded` | 429 | Kuota AI habis. | Google AI limit |

---

## Export/Import Errors

| Code | HTTP | Message | Context |
|------|------|---------|---------|
| `export_failed` | 500 | Gagal mengekspor data. | CSV/XLSX generation failed |
| `import_failed` | 500 | Gagal mengimpor data. | Bulk upload failed |

---

## Error Code Prefixes

| Prefix | Category |
|--------|----------|
| `auth_` | Authentication |
| `perm_` | Permission/Authorization |
| `val_` | Validation |
| `res_` | Resource not found |
| `biz_` | Business logic |
| `pay_` | Payment |
| `ship_` | Shipping |
| `ai_` | AI |
| `sys_` | System/Infrastructure |
| `rate_` | Rate limiting |

---

## Handling in Client

```typescript
try {
  const res = await fetchWithAuth('/api/checkout/xendit', { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json();
  
  if (!res.ok) {
    switch (data.code) {
      case 'insufficient_stock':
        showToast('Stok habis');
        break;
      case 'rate_limited':
        setTimeout(() => retry(), data.retry_after * 1000);
        break;
      case 'amount_mismatch':
        showError('Pembayaran gagal, silakan coba lagi');
        break;
      default:
        showError(data.error);
    }
    return;
  }
  // Success
} catch (err) {
  showError('Koneksi gagal');
}
```

---

## Related Docs

- [API: Overview](../api/overview.md) — Endpoints with error codes
- [API: Rate Limits](../api/rate-limits.md) — Rate limit errors
- [Security: Input Validation](../security/input-validation.md) — Validation patterns
- [Reference: Types](../reference/types.md) — TypeScript error types