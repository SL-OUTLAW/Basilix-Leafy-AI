export async function getFarmSchedule(token) {
  const response = await fetch("/api/farm/schedule", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error || "Failed to load farm schedule"
    );
  }

  return data;
}
