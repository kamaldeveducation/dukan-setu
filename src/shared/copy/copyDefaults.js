// A copy reuses its original's Storage object, so replacing the original's image must not overwrite it.
export function versionedImagePath(path) {
	return path.replace(/logo\.(webp|jpe?g)$/, (_, extension) => `logo-${Date.now()}.${extension}`)
}

export function buildCopyName(name) {
	return `${String(name ?? '').trim()} Copy`
}

// Codes are used as Firestore document IDs, so the result must stay unique among `takenCodes`.
export function buildUniqueCopyCode(sourceCode, takenCodes, maxLength = 50) {
	const taken = new Set(takenCodes)
	for (let attempt = 1; ; attempt += 1) {
		const suffix = attempt === 1 ? '_copy' : `_copy_${attempt}`
		const stem = sourceCode.slice(0, maxLength - suffix.length).replace(/_+$/, '')
		const candidate = `${stem}${suffix}`
		if (!taken.has(candidate)) return candidate
	}
}
