const elements = {
	serverVersion: document.getElementById('systemInfoServerVersion'),
	webVersion: document.getElementById('systemInfoWebVersion'),
	goVersion: document.getElementById('systemInfoGoVersion'),
	platform: document.getElementById('systemInfoPlatform'),
	osName: document.getElementById('systemInfoOsName'),
	hostname: document.getElementById('systemInfoHostname'),
}

void refreshMeta()

async function refreshMeta() {
	try {
		const response = await fetch('/api/meta', {
			credentials: 'same-origin',
			headers: {
				Accept: 'application/json',
			},
		})

		if (!response.ok) {
			throw new Error(`meta failed: ${response.status}`)
		}

		const meta = await response.json()
		elements.serverVersion.textContent = meta.version || 'Недоступно'
		elements.webVersion.textContent = meta.webVersion || 'Недоступно'
		elements.goVersion.textContent = meta.goVersion || 'Недоступно'
		elements.platform.textContent = meta.platform || 'Недоступно'
		elements.osName.textContent = meta.osName || 'Недоступно'
		elements.hostname.textContent = meta.hostname || 'Недоступно'
	} catch (error) {
		console.error(error)
		Object.values(elements).forEach(element => {
			element.textContent = 'Недоступно'
		})
	}
}
