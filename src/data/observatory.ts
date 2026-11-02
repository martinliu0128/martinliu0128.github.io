// What the observatory's main screen shows, from materials/astronomy module content.docx. One entry per page, in the
// order F turns through them; `photos` name files in src/assets/observatory, captions are short labels.
// `targets` fill the catalogue display beside the screen.
export const observatory = {
	panels: [
		{
			tag: '01',
			section: 'Childhood',
			title: 'Time that slows down',
			photos: [{ file: 'stargazing', caption: 'Stargazing sessions, high school' }],
			chips: ['Planetarium', 'Relativity', 'Summer camps'],
			paragraphs: [
				'Astronomy has fascinated me for as long as I can remember. As a child, I stumbled upon documentaries that showed nebulae, galaxies, and an expanding universe, and I grew curious about all the things that existed far beyond the reach of everyday life. In sixth grade, a visit to a planetarium sparked an impulse to try something new, and I bought a popular book on relativity. I couldn’t follow a single line of its mathematics, but its descriptions left me stunned: time that slows down, space that bends and stretches, gravity that is nothing more than the curvature of spacetime itself.',
				'This wasn’t just a new theory. It overturned my entire worldview and forced me to relearn the objective laws of the world around me. From the moment I was born, I had built my first theory of the world through hands-on experiment, by touching, dropping, and breaking things. Now I was building a new one, through learning and observation, that could hold a much larger world. In the years that followed, through documentaries, books, and summer camps, I kept chasing the questions that enchanted me: how galaxies form, how black holes collide, how the universe expands.',
			],
		},
		{
			tag: '02',
			section: 'Middle school',
			title: 'A night at Kanas',
			photos: [
				{ file: 'kanas-milky-way', caption: 'The Milky Way, Kanas' },
				{ file: 'kanas-night', caption: 'Kanas, Xinjiang' },
			],
			chips: ['Kanas, Xinjiang', 'Zero light pollution'],
			paragraphs: [
				'In middle school, I traveled to Kanas in Xinjiang. The scenic area was so remote that the power was cut off completely at night, turning the place into a natural observatory with zero light pollution. Around midnight, I lay down on the wooden boardwalk outside our cabin, wild grass growing thick on either side. Above the low ridgelines that ringed the dark valley, the sky was crowded with stars. As I stared upward, the sky suddenly stopped looking like a painting hung at an infinite distance. Space took on depth. The ground beneath me seemed to disappear, and I felt myself floating in the cosmos as a single individual, seeing each star for what it was, some near, some unimaginably far. A sense of vastness and smallness I had never known swallowed me whole.',
				'In an instant, my sense of “the world” expanded from the countries on Earth to the entire universe. The Milky Way stretching across the sky held hundreds of billions of points of light, each one a star. Each star had planets circling it, and each planet was a world of its own, the kind of “world” I had once believed ours to be. I am convinced that if everyone on Earth could see and feel what I did that night in Kanas, most of the conflicts on our planet would simply cease to exist.',
			],
		},
		{
			tag: '03',
			section: 'Research',
			title: 'Made of star-stuff',
			photos: [{ file: 'dark-matter', caption: 'Dark matter research, ApJ' }],
			chips: ['Dark matter', 'The Astrophysical Journal'],
			paragraphs: [
				'Later, when I learned about interstellar dust, I discovered something just as profound. In the first moments after the universe was born, only the lightest elements, hydrogen and helium, came into being. Everything heavier was forged later inside stars and then scattered into space when those stars died, eventually gathering into planets. This means that everything on Earth was made by stars. Every person, every computer, every breath of air was once a collection of atoms fused under the immense pressure of a stellar core. And the protons and neutrons that make up those atoms are as old as the universe itself, formed in the very instant of the Big Bang. Only then did I truly understand Carl Sagan’s famous words: “We are made of star-stuff.”',
			],
		},
		{
			tag: '04',
			section: 'College',
			title: 'The brightest object in the cosmos',
			photos: [
				{ file: 'mccormick', caption: 'McCormick Observatory, UVA' },
				{ file: 'm61', caption: 'M61, Fan Mountain Observatory' },
			],
			chips: ['Galaxies', 'Introduction to Cosmology', 'Prof. Mark Whittle'],
			paragraphs: [
				'In college, I took Professor Mark Whittle’s courses on Galaxies and Introduction to Cosmology, and through them I came to feel a strange contrast. On a physical scale, humans are tiny. All the influence we create in a lifetime, every emotion we experience, every person we meet, exists on a single blue planet. That planet is a minuscule speck within our galaxy, and our galaxy is itself a minuscule speck within the universe.',
				'Yet if we think from the perspective of system complexity, and imagine that every celestial object shines in proportion to how complex it is, the picture flips. Galaxies and stars grow dim, because we already understand how stars work and how orbits move within galaxies. Earth, by contrast, becomes the brightest object in the cosmos, its light strong enough to reach the other side of the universe. Every person’s joys and sorrows, every meeting and parting, are exactly what poets and writers have spent their lives trying to capture. And it is precisely because humans are so complex that we are able to appreciate the beauty of everything else in the sky. So although we are so small compared to the universe, from this perspective, the universe depends on us to appreciate itself.',
			],
		},
	],
	targets: [
		{ name: 'M61', kind: 'Spiral galaxy', note: 'First galaxy I imaged, Fan Mountain' },
		{ name: 'Milky Way', kind: 'Our galaxy', note: 'Kanas, Xinjiang, zero light pollution' },
		{ name: 'MW-like halos', kind: 'Dark matter', note: 'DREAMS CDM suite, published in ApJ' },
		{ name: 'Moon', kind: 'Satellite', note: 'High school stargazing sessions' },
		{ name: 'McCormick', kind: 'Observatory', note: 'University of Virginia' },
		{ name: 'Spacetime', kind: 'Relativity', note: 'Sixth grade, the book that started it' },
	],
};
