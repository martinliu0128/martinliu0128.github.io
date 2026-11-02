// What the concert hall's wall displays show, from materials/piano module content.docx. One entry per display, in the
// order they are met walking the hall: up the left aisle to the stage, then back down the right. `photos` name files
// in src/assets/piano. `film` is the recording on the stage screen; its file is public/media/piano.mp4.
export const piano = {
	panels: [
		{
			tag: '01',
			section: 'Beginnings',
			title: 'Starting at four',
			photos: [{ file: 'piano', caption: 'On stage' }],
			chips: ['Age four', 'Music theory class'],
			paragraphs: [
				'I started playing the piano at four, and seventeen years later, I still haven’t stopped. Like so many parents, mine bought me a piano hoping I would pick up a skill or find a hobby. From that moment on, my childhood looked a little different from everyone else’s in kindergarten, and practice quickly became my nightmare. When school let out, my classmates stayed in the plaza playing until dark, while I was called home early to sit at the keys. Music theory class was even worse. Every week, I spent three hours shut in a classroom with other restless kids just like me, learning music history, keys, and terminology when all any of us wanted was to run outside.',
			],
		},
		{
			tag: '02',
			section: 'Elementary and middle school',
			title: 'The background melody',
			photos: [],
			chips: ['An hour every evening', 'Accompanist at school'],
			paragraphs: [
				'In first and second grade, more than half my class was learning piano. Year by year, the number dwindled, and by graduation, only one other girl and I were still playing. Middle school brought everything it brings to everyone: heavier coursework, more frequent exams, and a growing list of clubs and activities. Yet piano was never something I considered giving up to make room for the rest. Somewhere in those years, it changed from something I resented into the background music of my life. During the day, my main melody was woven from many lines: classes, student council, math club, basketball, friends. But at night, as that melody faded, I could always hear a quieter line flowing steadily underneath. My hour of practice each evening became as automatic as muscle memory, and I never once thought of changing it.',
				'At school, I played whenever I had the chance, for classmates, for teachers, at events, even as accompaniment for school leaders’ speeches. The applause and praise that followed kept me going. Piano was never the brightest part of my day, but like a background melody, it kept moving quietly toward its own chords: on my weekly walks to my teacher’s house, in the hour I set aside from homework each night, and in the empty music room I slipped into on school afternoons.',
			],
		},
		{
			tag: '03',
			section: 'Competitions and performances',
			title: 'Under the spotlight',
			photos: [],
			chips: ['Competing', 'Performing'],
			paragraphs: [
				'All through those years, I kept competing and performing, and the stage shaped how I learned to handle pressure. I can still remember the rows of eyes fixed on me, my fingertips slightly damp with sweat, and the heat of the spotlight on my skin. The fear never disappeared, no matter how many times I performed, but I learned to live alongside it. I began to notice my emotions as they came: my heartbeat quickening, the “what if...” thoughts flickering through my mind. Once I could observe those feelings, they no longer took over my thinking, and I could focus on each note in front of me.',
				'Over time, I came to understand that the answer to anxiety about the future is to master the movement happening right now.',
			],
		},
		{
			tag: '04',
			section: 'High school',
			title: 'Playing on my own',
			photos: [],
			chips: ['Self-taught since high school'],
			paragraphs: [
				'In high school, the workload grew so heavy that I had to stop my weekly lessons and practice on my own. Honestly, that should have been the end. Without a teacher’s guidance, without anyone to catch and correct my mistakes, there was no realistic way to keep advancing. Yet during that very first week without lessons, I found myself opening the piano every night and sitting down for an hour anyway.',
				'At first, I told myself it was just inertia; a habit kept for more than a decade doesn’t simply vanish. But gradually, I realized my relationship with the piano had shifted. Through high school and college, my worries multiplied. Pressure from schoolwork, applications, and the job search pulled at my peace of mind from every direction.',
			],
		},
		{
			tag: '05',
			section: 'High school and college',
			title: 'A world of my own',
			photos: [],
			chips: ['Beethoven', 'Chopin', 'Rachmaninoff', 'The Art of Loving'],
			paragraphs: [
				'And yet each night, sitting at the piano felt like a devoted priest kneeling in prayer. However cluttered and chaotic the day had been, I could always return to a world I knew by heart, where I felt Beethoven defying fate, Chopin raging at the invasion of his homeland, and Rachmaninoff mourning a home he could never return to, while finding a kind of rebirth. With my own two hands, I could create a world on the keyboard that belonged entirely to me. No one else could intrude there; in that world, I was in complete command.',
				'Years later, reading Erich Fromm’s The Art of Loving, I came across an idea that finally explained it. Fromm describes the outside world as uncertain, leaving each of us, as a separate and solitary being, feeling powerless and afraid at the deepest level. And so we instinctively create worlds of our own, where a sense of control brings comfort and peace. That, I think, is why I keep finding myself at the piano.',
			],
		},
		{
			tag: '06',
			section: 'Coda',
			title: 'One of the essential voices',
			photos: [],
			chips: ['Seventeen years and counting'],
			paragraphs: [
				'Looking back, I first resisted the piano because it demanded more of me than other kids had to give. Then, through the encouragement of elementary and middle school, I slowly came to accept it. And finally, I came to love it for its own sake.',
				'Piano is no longer just background music for me. Even if it isn’t the main melody, it will always be one of the essential voices in the harmony of my life.',
			],
		},
	],
	film: { poster: 'recital', title: 'Recital', caption: 'A performance on the concert grand' },
};
