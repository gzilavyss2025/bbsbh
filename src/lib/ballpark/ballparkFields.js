// Older-configuration outfield-wall polygons for the ballpark diagram, digitized
// from the GeomMLBStadiums dataset (github.com/bdilday/GeomMLBStadiums, MIT).
// Each one draws a wall a club has since rebuilt, on that wall's own dates.
//
// Each value is the outfield fence as an ordered LF-pole -> RF-pole point list in
// FEET, home plate at (0,0), +x toward right field, +y toward center field -- the
// same frame as ballparkGeometry.js. Extracted from the dataset's `outfield_outer`
// segment (its outfield arc tracks the posted fence distances), transformed to
// feet (x=2.4957*(hc_x-125), y=2.4957*(199-hc_y)) and Douglas-Peucker-simplified
// to ~1.6 ft. Keyed by normalized venue name like ballparkData.js. That fixed
// transform runs a few percent large against Savant (#1859; the Gameday import
// measures the frame at 2.40 ft/unit), which the CF audit tolerates.
//
// Only the traces that stand for an OLDER configuration are kept, keyed by the
// park each trace SHOWS (the Rangers trace predates Globe Life Field, so it sits
// under Globe Life Park in Arlington). Every current park now draws its audited
// Gameday outline (./layout/fields.js) instead. Which trace stands for which
// configuration on which dates is decided in ./layout/configurations.js.

export const WALLS = {
  comericapark: [[-207.7,185.9],[-250.2,228.4],[-250.4,242.1],[-69.5,422.3],[-55.8,426.3],[64.4,430],[79.2,428.4],[142,364.1],[152.2,336.3],[237.1,251.2],[245,239.3],[240.3,210.1]],
  daikinpark: [[-172.8,151.3],[-234.9,213.6],[-229.6,222.9],[-144.5,303.6],[-143.5,316.9],[-145.9,331.3],[-20.3,432.2],[-6.6,434.6],[7.7,431.3],[15.6,443.5],[44.1,439.9],[69.6,425.9],[125.7,358.7],[135.8,348.2],[148.1,342],[241.6,229.1],[234.5,217.4],[192.8,176.2],[191.7,170.7]],
  globelifeparkinarlington: [[-216.1,189.7],[-243.4,224.4],[-244.2,237.8],[-235.6,265.9],[-228.6,278.5],[-134.6,371.6],[-53.5,405.5],[64.2,406.1],[78.8,405.2],[121.1,364.8],[146.6,353.9],[229.8,270.7],[238.5,259.4],[241.2,230.1],[239.8,216.3],[201.8,175.8]],
  kauffmanstadium: [[-233.2,207.8],[-244.6,235.7],[-246.6,250.6],[-244.5,265.5],[-238.7,279.4],[-229.7,291.5],[-175.3,343.9],[-140,372.3],[-100.7,394.6],[-57.7,408.9],[-27.9,414],[2.3,415.6],[47.3,410.8],[90.8,398.6],[131.1,377.8],[179.2,341.4],[232.7,288.1],[240.9,275.5],[245.9,261.2],[246.8,246.2],[233.2,203.1]],
  loandepotpark: [[-234.6,205.3],[-251.3,228.5],[-229.7,266.5],[-202.7,300.9],[-159.4,340.1],[-113,375],[-72.7,392.1],[-61.1,400.9],[-42.5,422.2],[-27.9,422.7],[15.7,418.8],[58.4,409.2],[85.7,398.8],[124.3,378.2],[156.1,348.3],[245.9,233.2],[248.4,220.4],[239.4,208.9]],
  orioleparkatcamdenyards: [[-217.7,191.4],[-241.4,225.1],[-245.3,247.6],[-254.5,276.5],[-243,303.7],[-130,380.2],[-118.6,382.8],[-110,370.3],[-99.7,367.2],[-37.1,410.1],[-23.2,410.1],[123.1,370.1],[136.6,369.2],[173.1,311],[186.3,306.9],[201.5,306.5],[227.3,236.4],[239.4,214.6]],
  rogerscentre: [[-232.1,204.4],[-242.1,231],[-161,345.7],[-97.3,391],[-83.4,397.8],[-37.1,404.5],[9.8,406],[56.5,402.2],[87.1,396.4],[163.5,342.3],[235.1,239.8],[241.9,226.7],[225.5,200.6]],
}
