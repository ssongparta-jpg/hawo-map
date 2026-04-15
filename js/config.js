// js/config.js 에는 이것만 남겨야 합니다.
const MapConfig = {
    SHEET_ID: '1xzpPpZh00DCC6zl0PhVx7uGab_6-9qkPhTHqcz5yuIE',
    GIDS: { 
        HEADER: '1120810254', 
        POINTS: '1290947643', 
        LEGEND: '882261582',
        SHARED: '1582242290' 
    },
    MAP_CENTER: [37.196554, 126.911871],
    BOUNDS: [[36.886521, 126.557641], [37.403725, 127.272064]],
    DISTRICTS: {
        "화성시": { pos: [37.185, 126.915], color: "#4A90E2", fullName: "화성시 전체" },
        "오산시": { pos: [37.16361, 127.06229], color: "#be522e", fullName: "오산시" },
        "동탄구": { pos: [37.198, 127.09], color: "#d49400", fullName: "화성시 동탄구", keywords: ['동탄', '오산동'] },
        "병점구": { pos: [37.223, 127.022], color: "#9933CC", fullName: "화성시 병점구", keywords: ['진안', '병점', '반월', '화산', '안녕', '송산동'] },
        "효행구": { pos: [37.214, 126.925], color: "#3366FF", fullName: "화성시 효행구", keywords: ['봉담', '비봉', '매송', '정남', '기배'] },
        "만세구": { pos: [37.152, 126.892], color: "#71a5ce", fullName: "화성시 만세구", keywords: ['향남', '우정', '팔탄', '장안', '양감', '마도', '송산면', '서신', '남양', '새솔'] }
    }
};