// Images (face captures, observation photos) are stored directly in the database
// as base64 data-URLs, so they persist with the rest of the data. This helper
// just validates/normalises the incoming value.
function saveDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  if (dataUrl.startsWith("data:image/") || dataUrl.startsWith("http") || dataUrl.startsWith("/uploads/"))
    return dataUrl;
  return null;
}
module.exports = { saveDataUrl };
