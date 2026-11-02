// The games in the arcade, from materials/video games content.docx, grouped by series in the order they hang.
// `key` names each game's poster; the posters sit in src/assets/arcade/posters.jpg, seven to a row in exactly this
// order, so a game added here needs its poster added to the atlas in the same place. `no` is the series number
// as the list gives it. Posters are each game's Steam library art.
export const arcade = {
	atlas: { cols: 7, rows: 4 },
	series: [
		{
			name: 'Call of Duty',
			accent: '#3de8ff',
			games: [
				{ key: 'cod1', no: 1, title: 'Call of Duty', year: 2003 },
				{ key: 'cod2', no: 2, title: 'Call of Duty 2', year: 2005 },
				{ key: 'cod4', no: 4, title: 'Modern Warfare', year: 2007 },
				{ key: 'codwaw', no: 5, title: 'World at War', year: 2008 },
				{ key: 'codmw2', no: 6, title: 'Modern Warfare 2', year: 2009 },
				{ key: 'codbo', no: 7, title: 'Black Ops', year: 2010 },
				{ key: 'codmw3', no: 8, title: 'Modern Warfare 3', year: 2011 },
				{ key: 'codbo2', no: 9, title: 'Black Ops II', year: 2012 },
				{ key: 'codghosts', no: 10, title: 'Ghosts', year: 2013 },
				{ key: 'codaw', no: 11, title: 'Advanced Warfare', year: 2014 },
				{ key: 'codbo3', no: 12, title: 'Black Ops III', year: 2015 },
				{ key: 'codiw', no: 13, title: 'Infinite Warfare', year: 2016 },
				{ key: 'codwwii', no: 14, title: 'WWII', year: 2017 },
			],
		},
		{
			name: 'Tomb Raider',
			accent: '#ffb43a',
			games: [
				{ key: 'tr2013', no: 9, title: 'Tomb Raider', year: 2013 },
				{ key: 'rottr', no: 10, title: 'Rise of the Tomb Raider', year: 2015 },
				{ key: 'sottr', no: 11, title: 'Shadow of the Tomb Raider', year: 2018 },
			],
		},
		{
			name: 'Battlefield',
			accent: '#ff6a2b',
			games: [
				{ key: 'bf3', no: 3, title: 'Battlefield 3', year: 2011 },
				{ key: 'bf1', no: 1, title: 'Battlefield 1', year: 2016 },
				{ key: 'bfv', no: 5, title: 'Battlefield V', year: 2018 },
			],
		},
		{
			name: 'Forza Horizon',
			accent: '#ff3d9a',
			games: [
				{ key: 'fh4', no: 4, title: 'Forza Horizon 4', year: 2018 },
				{ key: 'fh5', no: 5, title: 'Forza Horizon 5', year: 2021 },
				{ key: 'fh6', no: 6, title: 'Forza Horizon 6', year: 2026 },
			],
		},
		{
			name: 'Watch Dogs',
			accent: '#b6ff3d',
			games: [
				{ key: 'wd2', no: 2, title: 'Watch Dogs 2', year: 2016 },
				{ key: 'wdl', no: 3, title: 'Watch Dogs: Legion', year: 2020 },
			],
		},
		{
			name: 'Featured',
			accent: '#a46bff',
			games: [
				{ key: 'cyberpunk', title: 'Cyberpunk 2077', year: 2020 },
				{ key: 'rdr2', title: 'Red Dead Redemption 2', year: 2018 },
				{ key: 'itt', title: 'It Takes Two', year: 2021 },
				{ key: 'ghostrunner', title: 'Ghostrunner', year: 2020 },
			],
		},
	],
};
