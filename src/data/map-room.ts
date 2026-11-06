// What the map room shows, from materials/travel module content.docx. The first entry is the introduction on the
// great screen at the far end; the others hang on the walls under the galleries, two each side. `photos` name files
// in src/assets/map-room, captions are short labels. `pins` stand on the map table at the places the stories happened,
// and `board` fills the split-flap board under the great screen.
export const mapRoom = {
	panels: [
		{
			tag: '00',
			section: 'Introduction',
			title: 'Let curiosity lead',
			photos: [{ file: 'road-318', caption: 'On the road' }],
			chips: ['Across continents', 'Detours over itineraries'],
			paragraphs: [
				'For as long as I can remember, my parents have been taking me out into the world. Growing up, I traveled with them across continents and through many countries, experiencing landscapes and cultures that looked nothing like home. Every place we visited came with a plan: sights to see, tours to join, schedules to keep. But over the years, I noticed that the moments I remember most clearly were almost never the ones on the itinerary. They were the detours, the surprises, and the times I followed a question instead of a map. Travel has taught me that curiosity is the best guide I could ask for.',
			],
		},
		{
			tag: '01',
			section: 'Spain',
			title: 'On foot, before the tour',
			photos: [{ file: 'waterfront', caption: 'By the water' }],
			chips: ['Ten miles on foot', 'The old town at dawn'],
			paragraphs: [
				'I love exploring places on foot. During a trip to Spain, I woke up early and headed into the old town well before our guided tour was due to begin. By the time I rejoined the group, I had walked ten miles. Those quiet early hours showed me a version of the city that no tour bus ever could. The white marble walls glowed in the morning sunlight, while the streetlamps cast long shadows across the empty cobblestone streets. No guide was telling me where to go next, so I simply followed whatever caught my attention. Walking without a fixed route forces me to slow down and notice the small details that others hurry past. It was a side of the city I would never have discovered on a typical group tour. Since that morning, I have believed that the best way to understand a place is to wander freely and letting curiosity, rather than an itinerary, lead the way.',
			],
		},
		{
			tag: '02',
			section: 'Kenya',
			title: 'A different kind of wealth',
			photos: [],
			chips: ['A Maasai community', 'Joy and belonging'],
			paragraphs: [
				'Sometimes curiosity leads me to places where the differences run far deeper than architecture. During a trip to Kenya, I visited a Maasai community on the savanna and was fascinated by a way of life so different from my own. Their homes were built from mud and grass, and their sandals were made from recycled tires. Few of the modern conveniences I had always taken for granted were part of daily life there. At first, I couldn’t stop comparing what they had with what I had. But the longer I stayed, the less those comparisons seemed to matter. Children laughed as they kicked a soccer ball around, and adults gathered around a campfire, clapping together as one. Despite the simplicity of their material surroundings, I witnessed a strong sense of joy and community. Wealth can certainly improve our lives, but that visit showed me that true fulfillment more often comes from human connection, a sense of belonging, and joy in the simplest moments.',
			],
		},
		{
			tag: '03',
			section: 'Kenya',
			title: 'Following the eagles',
			photos: [{ file: 'safari', caption: 'Across the savanna by jeep' }],
			chips: ['The savanna', 'Migrating antelopes', 'Giraffes'],
			paragraphs: [
				'Some of my favorite moments of curiosity came when I wasn’t in control at all. In Kenya, we rode across the vast savanna in a jeep, searching for wildlife. There was no guarantee of what we would find, and our days were shaped by the land and the animals rather than by a schedule. We crossed rivers alongside migrating antelopes. When eagles soared overhead, we followed them to spot animals in the distance that we couldn’t yet see. At one point, we walked side by side with giraffes and saw just how small we were next to them. Learning to be comfortable with that uncertainty became part of the adventure. So much of everyday life is planned down to the hour. I felt that the most extraordinary experiences come not from controlling where we go, but from staying open, paying attention, and embracing the unpredictability of the journey.',
			],
		},
		{
			tag: '04',
			section: 'At the zoo',
			title: 'The sloppiest kiss of my life',
			photos: [{ file: 'giraffe-kiss', caption: 'The giraffe kiss' }],
			chips: ['A little bolder', 'Over in a second'],
			paragraphs: [
				'And sometimes, curiosity leads somewhere wonderfully ridiculous. I once kissed a giraffe! At a zoo, I decided to try something a little bolder than feeding it by hand. I held a piece of food between my lips, leaned forward, and waited. The giraffe lowered its enormous head toward me, stretched out its long tongue, and grabbed the food right off my face. It was over in a second. It was probably the most unexpected kiss of my life, and certainly the sloppiest!',
			],
		},
	],
	pins: [
		{ label: 'Spain', note: '01  On foot, before the tour', lat: 40.4, lon: -3.7 },
		{ label: 'Kenya', note: '02, 03  The Maasai and the savanna', lat: -1.5, lon: 35.1 },
	],
	board: [
		{ time: '06:10', to: 'SPAIN', note: 'OLD TOWN ON FOOT', rec: '01', status: 'ARRIVED' },
		{ time: '09:45', to: 'KENYA', note: 'A MAASAI COMMUNITY', rec: '02', status: 'ARRIVED' },
		{ time: '13:20', to: 'KENYA', note: 'FOLLOWING THE EAGLES', rec: '03', status: 'ARRIVED' },
		{ time: '16:05', to: 'THE ZOO', note: 'ONE GIRAFFE KISS', rec: '04', status: 'ARRIVED' },
		{ time: '--:--', to: 'ANYWHERE', note: 'LET CURIOSITY LEAD', rec: '00', status: 'BOARDING' },
	],
};
