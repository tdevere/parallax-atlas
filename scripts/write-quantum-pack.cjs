const fs = require('fs')

const data = {
  id: "quantum-physics-survey",
  name: "Quantum Physics Survey",
  description: "A learner-focused overview of foundational milestones in quantum theory and modern applications.",
  context: {
    persistence: "memory",
    eras: [
      {
        id: "blackbody-crisis", content: "Blackbody Radiation Crisis", start: 130, end: 125, group: "Foundations",
        description: "Classical physics fails to explain blackbody spectra, motivating new theoretical approaches.",
        geoCenter: { latitude: 52.52, longitude: 13.405, zoom: 12, heading: 0 },
        sources: [
          { id: "blackbody-wiki", title: "Ultraviolet Catastrophe", url: "https://en.wikipedia.org/wiki/Ultraviolet_catastrophe", format: "overview", domain: "wikipedia.org", snippet: "How classical physics predicted infinite energy at short wavelengths, triggering the quantum revolution." },
          { id: "blackbody-planck-1901", title: "On the Law of Distribution of Energy in the Normal Spectrum", url: "https://en.wikisource.org/wiki/Translation:On_the_Law_of_Distribution_of_Energy_in_the_Normal_Spectrum", format: "paper", author: "Max Planck", year: 1901, domain: "wikisource.org", snippet: "Planck's original paper introducing discrete energy quanta to resolve the ultraviolet catastrophe." },
          { id: "blackbody-pbs", title: "How Quantum Mechanics Was Born", url: "https://www.youtube.com/watch?v=zNzzGgr2mhk", format: "video", author: "PBS Space Time", year: 2016, domain: "youtube.com", snippet: "Visual introduction to the blackbody radiation problem and how it catalyzed quantum theory." },
          { id: "blackbody-sep", title: "The Role of Decoherence in Quantum Mechanics", url: "https://plato.stanford.edu/entries/qm-decoherence/", format: "overview", domain: "plato.stanford.edu", snippet: "Stanford Encyclopedia entry providing philosophical context for quantum foundations." }
        ]
      },
      {
        id: "planck-quantization", content: "Planck Quantization", start: 125, end: 124, group: "Foundations",
        description: "Planck proposes discrete energy quanta to match observed radiation curves.",
        geoCenter: { latitude: 52.5186, longitude: 13.393, zoom: 14, heading: 0 },
        sources: [
          { id: "planck-nobel", title: "The Genesis and Present State of Development of the Quantum Theory (Nobel Lecture)", url: "https://www.nobelprize.org/prizes/physics/1918/planck/lecture/", format: "lecture", author: "Max Planck", year: 1918, domain: "nobelprize.org", snippet: "Planck's own account of how the quantum hypothesis emerged from his radiation work." },
          { id: "planck-wiki", title: "Planck's Law", url: "https://en.wikipedia.org/wiki/Planck%27s_law", format: "overview", domain: "wikipedia.org", snippet: "Comprehensive overview of Planck's radiation law and its role in the birth of quantum theory." },
          { id: "planck-kuhn", title: "Black-Body Theory and the Quantum Discontinuity, 1894\u20131912", url: "https://press.uchicago.edu/ucp/books/book/chicago/B/bo5955846.html", format: "book", author: "Thomas S. Kuhn", year: 1978, domain: "uchicago.edu", snippet: "Influential historical analysis of how Planck arrived at the quantum hypothesis." }
        ]
      },
      {
        id: "einstein-photoelectric", content: "Photoelectric Effect", start: 121, end: 120, group: "Foundations",
        description: "Einstein explains photoelectric observations using light quanta, strengthening quantum ideas.",
        geoCenter: { latitude: 46.948, longitude: 7.4474, zoom: 14, heading: 0 },
        sources: [
          { id: "einstein-1905", title: "On a Heuristic Point of View Concerning the Production and Transformation of Light", url: "https://en.wikisource.org/wiki/Translation:On_a_Heuristic_Point_of_View_about_the_Creation_and_Conversion_of_Light", format: "paper", author: "Albert Einstein", year: 1905, domain: "wikisource.org", snippet: "Einstein's Nobel-winning paper applying Planck's quanta to explain the photoelectric effect." },
          { id: "einstein-nobel", title: "Albert Einstein \u2014 Nobel Prize in Physics 1921", url: "https://www.nobelprize.org/prizes/physics/1921/einstein/biographical/", format: "overview", author: "Nobel Foundation", year: 1921, domain: "nobelprize.org", snippet: "Nobel Prize biography and context for Einstein's contribution to quantum theory." },
          { id: "photoelectric-khan", title: "Photoelectric Effect", url: "https://www.khanacademy.org/science/physics/quantum-physics/photons/v/photoelectric-effect", format: "video", domain: "khanacademy.org", snippet: "Clear educational walkthrough of the photoelectric effect and its quantum implications." },
          { id: "photoelectric-wiki", title: "Photoelectric Effect", url: "https://en.wikipedia.org/wiki/Photoelectric_effect", format: "overview", domain: "wikipedia.org", snippet: "Historical development, experimental observations, and Einstein's quantum explanation." }
        ]
      },
      {
        id: "bohr-atom", content: "Bohr Atomic Model", start: 113, end: 111, group: "Foundations",
        description: "Quantized electron orbits explain hydrogen spectral lines with partial success.",
        geoCenter: { latitude: 55.6761, longitude: 12.5683, zoom: 13, heading: 0 },
        sources: [
          { id: "bohr-1913", title: "On the Constitution of Atoms and Molecules", url: "https://web.ihep.su/dbserv/compas/src/bohr13/eng.pdf", format: "paper", author: "Niels Bohr", year: 1913, domain: "ihep.su", snippet: "Bohr's foundational trilogy introducing quantized atomic orbits." },
          { id: "bohr-aip", title: "Niels Bohr's Atomic Model", url: "https://history.aip.org/exhibits/heisenberg/p06.htm", format: "overview", domain: "history.aip.org", snippet: "American Institute of Physics overview of the Bohr model and its historical impact." },
          { id: "bohr-wiki", title: "Bohr Model", url: "https://en.wikipedia.org/wiki/Bohr_model", format: "overview", domain: "wikipedia.org", snippet: "Detailed article covering the model's derivation, successes, and eventual replacement." }
        ]
      },
      {
        id: "wave-matrix-mechanics", content: "Wave and Matrix Mechanics", start: 100, end: 98, group: "Formalism",
        description: "Heisenberg and Schr\u00f6dinger establish equivalent quantum formulations.",
        geoCenter: { latitude: 51.5339, longitude: 9.9356, zoom: 13, heading: 0 },
        sources: [
          { id: "schrodinger-1926", title: "An Undulatory Theory of the Mechanics of Atoms and Molecules", url: "https://doi.org/10.1103/PhysRev.28.1049", format: "paper", author: "Erwin Schr\u00f6dinger", year: 1926, domain: "doi.org", snippet: "Schr\u00f6dinger's wave mechanics paper establishing the famous equation." },
          { id: "heisenberg-1925", title: "Quantum-Theoretical Re-interpretation of Kinematic and Mechanical Relations", url: "https://en.wikipedia.org/wiki/Umdeutung_paper", format: "overview", domain: "wikipedia.org", snippet: "Context and analysis of Heisenberg's matrix mechanics breakthrough paper." },
          { id: "3b1b-schrodinger", title: "The Schr\u00f6dinger Equation \u2014 Visualized", url: "https://www.youtube.com/watch?v=kUm4q-VZttw", format: "video", author: "3Blue1Brown", domain: "youtube.com", snippet: "Elegant visual explanation of the Schr\u00f6dinger equation and what it actually describes." },
          { id: "matrix-wiki", title: "Matrix Mechanics", url: "https://en.wikipedia.org/wiki/Matrix_mechanics", format: "overview", domain: "wikipedia.org", snippet: "The first complete and correct formulation of quantum mechanics." }
        ]
      },
      {
        id: "uncertainty-principle", content: "Uncertainty Principle", start: 98, end: 97, group: "Formalism",
        description: "Conjugate observables cannot be simultaneously specified with arbitrary precision.",
        geoCenter: { latitude: 55.6969, longitude: 12.571, zoom: 15, heading: 0 },
        sources: [
          { id: "heisenberg-1927", title: "\u00dcber den anschaulichen Inhalt der quantentheoretischen Kinematik und Mechanik", url: "https://doi.org/10.1007/BF01397280", format: "paper", author: "Werner Heisenberg", year: 1927, domain: "doi.org", snippet: "The original uncertainty principle paper establishing fundamental measurement limits." },
          { id: "uncertainty-sep", title: "The Uncertainty Principle", url: "https://plato.stanford.edu/entries/qt-uncertainty/", format: "overview", domain: "plato.stanford.edu", snippet: "Stanford Encyclopedia analysis of the principle's physical and philosophical content." },
          { id: "uncertainty-veritasium", title: "The Uncertainty Principle Is Not About Measurement", url: "https://www.youtube.com/watch?v=MBnnXbOM5S4", format: "video", author: "Veritasium", domain: "youtube.com", snippet: "Corrects common misconceptions about the uncertainty principle with clear demonstrations." }
        ]
      },
      {
        id: "qed-development", content: "Quantum Electrodynamics", start: 80, end: 70, group: "Quantum Field Theory",
        description: "Renormalized QED provides highly accurate predictions of electromagnetic processes.",
        geoCenter: { latitude: 42.4534, longitude: -76.4735, zoom: 13, heading: 0 },
        sources: [
          { id: "feynman-qed-book", title: "QED: The Strange Theory of Light and Matter", url: "https://en.wikipedia.org/wiki/QED:_The_Strange_Theory_of_Light_and_Matter", format: "book", author: "Richard Feynman", year: 1985, domain: "wikipedia.org", snippet: "Feynman's masterful popular account of quantum electrodynamics for general audiences." },
          { id: "schwinger-nobel", title: "Relativistic Quantum Field Theory (Nobel Lecture)", url: "https://www.nobelprize.org/prizes/physics/1965/schwinger/lecture/", format: "lecture", author: "Julian Schwinger", year: 1965, domain: "nobelprize.org", snippet: "Schwinger's Nobel lecture on his approach to renormalized QED." },
          { id: "qed-wiki", title: "Quantum Electrodynamics", url: "https://en.wikipedia.org/wiki/Quantum_electrodynamics", format: "overview", domain: "wikipedia.org", snippet: "Overview of QED as the most precisely tested physical theory in history." },
          { id: "feynman-lectures", title: "Feynman Lectures: Quantum Mechanics", url: "https://www.feynmanlectures.caltech.edu/III_toc.html", format: "lecture", author: "Richard Feynman", domain: "caltech.edu", snippet: "Volume III of the Feynman Lectures covering quantum mechanics foundations." }
        ]
      },
      {
        id: "bell-inequalities", content: "Bell Inequalities", start: 61, end: 59, group: "Entanglement",
        description: "Bell derives testable constraints distinguishing local hidden-variable models from quantum mechanics.",
        geoCenter: { latitude: 46.233, longitude: 6.0557, zoom: 14, heading: 0 },
        sources: [
          { id: "bell-1964", title: "On the Einstein Podolsky Rosen Paradox", url: "https://cds.cern.ch/record/111654/files/vol1p195-200_001.pdf", format: "paper", author: "John S. Bell", year: 1964, domain: "cern.ch", snippet: "Bell's landmark paper proving no local hidden-variable theory can reproduce all quantum predictions." },
          { id: "epr-1935", title: "Can Quantum-Mechanical Description of Physical Reality Be Considered Complete?", url: "https://doi.org/10.1103/PhysRev.47.777", format: "paper", author: "Einstein, Podolsky, Rosen", year: 1935, domain: "doi.org", snippet: "The EPR paper that prompted Bell's theorem \u2014 arguing quantum mechanics is incomplete." },
          { id: "bell-sep", title: "Bell's Theorem", url: "https://plato.stanford.edu/entries/bell-theorem/", format: "overview", domain: "plato.stanford.edu", snippet: "Thorough philosophical and technical treatment of Bell's theorem and its implications." },
          { id: "bell-veritasium", title: "Bell's Theorem: The Quantum Venn Diagram Paradox", url: "https://www.youtube.com/watch?v=zcqZHYo7ONs", format: "video", author: "Veritasium", domain: "youtube.com", snippet: "Accessible visual explanation of Bell inequalities using Venn diagram analogy." }
        ]
      },
      {
        id: "entanglement-experiments", content: "Entanglement Experiments", start: 43, end: 40, group: "Entanglement",
        description: "Experiments provide strong evidence consistent with nonlocal quantum correlations.",
        geoCenter: { latitude: 48.6994, longitude: 2.1713, zoom: 13, heading: 0 },
        sources: [
          { id: "aspect-1982", title: "Experimental Realization of Einstein-Podolsky-Rosen-Bohm Gedankenexperiment", url: "https://doi.org/10.1103/PhysRevLett.49.1804", format: "paper", author: "Alain Aspect, Philippe Grangier, G\u00e9rard Roger", year: 1982, domain: "doi.org", snippet: "Landmark experiment demonstrating violation of Bell inequalities with time-varying analyzers." },
          { id: "nobel-2022", title: "Nobel Prize in Physics 2022: Aspect, Clauser, Zeilinger", url: "https://www.nobelprize.org/prizes/physics/2022/summary/", format: "overview", author: "Nobel Foundation", year: 2022, domain: "nobelprize.org", snippet: "Nobel Prize for experiments establishing violation of Bell inequalities and pioneering quantum information." },
          { id: "hensen-2015", title: "Loophole-free Bell inequality violation using electron spins", url: "https://doi.org/10.1038/nature15759", format: "paper", author: "Hensen et al.", year: 2015, domain: "nature.com", snippet: "First loophole-free Bell test closing both detection and locality loopholes." },
          { id: "entanglement-veritasium", title: "The Experiment That Satisfies Einstein", url: "https://www.youtube.com/watch?v=ZuvK-od647c", format: "video", author: "Veritasium", domain: "youtube.com", snippet: "Documentary-style walkthrough of the Nobel-winning entanglement experiments." }
        ]
      },
      {
        id: "quantum-information-era", content: "Quantum Information Era", start: 30, end: 0, group: "Applications",
        description: "Quantum computation, communication, and sensing transition from theory toward engineering platforms.",
        geoCenter: { latitude: 48.2082, longitude: 16.3738, zoom: 12, heading: 0 },
        sources: [
          { id: "shor-1994", title: "Algorithms for Quantum Computation: Discrete Logarithms and Factoring", url: "https://arxiv.org/abs/quant-ph/9508027", format: "paper", author: "Peter Shor", year: 1994, domain: "arxiv.org", snippet: "Shor's algorithm for integer factoring in polynomial time on a quantum computer." },
          { id: "preskill-nisq", title: "Quantum Computing in the NISQ Era and Beyond", url: "https://arxiv.org/abs/1801.00862", format: "paper", author: "John Preskill", year: 2018, domain: "arxiv.org", snippet: "Defines the NISQ era and outlines near-term quantum computing prospects and limitations." },
          { id: "ibm-quantum", title: "IBM Quantum Experience", url: "https://quantum.ibm.com/", format: "dataset", domain: "ibm.com", snippet: "Free cloud access to real quantum processors for experimentation and learning." },
          { id: "qinfo-wiki", title: "Quantum Computing", url: "https://en.wikipedia.org/wiki/Quantum_computing", format: "overview", domain: "wikipedia.org", snippet: "Comprehensive overview of quantum computing: qubits, gates, algorithms, and hardware." },
          { id: "nielsen-chuang", title: "Quantum Computation and Quantum Information", url: "https://en.wikipedia.org/wiki/Quantum_Computation_and_Quantum_Information", format: "book", author: "Michael Nielsen, Isaac Chuang", year: 2000, domain: "wikipedia.org", snippet: "The standard graduate-level textbook on quantum computation and information theory." }
        ]
      }
    ],
    progress: {
      "blackbody-crisis": 0,
      "planck-quantization": 0,
      "einstein-photoelectric": 0,
      "bohr-atom": 0,
      "wave-matrix-mechanics": 0,
      "uncertainty-principle": 0,
      "qed-development": 0,
      "bell-inequalities": 0,
      "entanglement-experiments": 0,
      "quantum-information-era": 0
    }
  }
}

fs.writeFileSync("public/subject-packs/quantum-physics-survey.json", JSON.stringify(data, null, 2))
console.log("Written", Object.keys(data.context.eras).length, "eras with sources")
