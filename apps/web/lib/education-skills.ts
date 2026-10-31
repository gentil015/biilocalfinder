/**
 * Degree/programme catalogue for provider education.
 *
 * The education form no longer asks providers to type a degree: they pick
 * one of these programmes, and the skill picker below it only offers the
 * skills that belong to that programme. Skills are stored as their labels on
 * the education row, so the public profile can render them without needing
 * this file at runtime.
 *
 * Keep the labels stable — existing rows reference them by value. Adding a
 * programme or skill is safe; renaming one makes old rows fall back to the
 * "Other" path.
 */

export const OTHER_DEGREE = '__other__';

export interface DegreeProgram {
  label: string;
  skills: string[];
}

export const DEGREE_PROGRAMS: DegreeProgram[] = [
  {
    label: 'Electrical Installation',
    skills: [
      'Electrical wiring',
      'Circuit installation',
      'Fault finding',
      'Panel wiring',
      'Lighting installation',
      'Motor control',
      'Electrical safety',
      'Solar PV installation',
      'Conduit installation',
      'Reading electrical drawings',
    ],
  },
  {
    label: 'Plumbing & Water Systems',
    skills: [
      'Pipe fitting',
      'Leak repair',
      'Drainage systems',
      'Water pump installation',
      'Sanitary installation',
      'Water tank installation',
      'Pipe threading',
      'Plumbing maintenance',
      'Soldering & brazing',
      'Reading plumbing plans',
    ],
  },
  {
    label: 'Carpentry & Joinery',
    skills: [
      'Furniture making',
      'Door & window fitting',
      'Roof carpentry',
      'Cabinet installation',
      'Wood finishing',
      'Measuring & cutting',
      'Joinery repair',
      'Staircase construction',
      'Woodworking tools',
      'Reading workshop drawings',
    ],
  },
  {
    label: 'Welding & Metal Fabrication',
    skills: [
      'Arc welding',
      'MIG welding',
      'TIG welding',
      'Metal cutting',
      'Gate fabrication',
      'Window grills',
      'Metal finishing',
      'Blueprint reading',
      'Workshop safety',
      'Structural fabrication',
    ],
  },
  {
    label: 'Automotive Mechanics',
    skills: [
      'Engine repair',
      'Brake systems',
      'Suspension repair',
      'Vehicle diagnostics',
      'Electrical systems',
      'Transmission repair',
      'Oil & filter service',
      'Tyre fitting',
      'AC repair',
      'Preventive maintenance',
    ],
  },
  {
    label: 'Construction & Masonry',
    skills: [
      'Brick laying',
      'Concrete work',
      'Plastering',
      'Tiling',
      'Foundation work',
      'Site supervision',
      'Reinforced concrete',
      'Block work',
      'Construction safety',
      'Reading building plans',
    ],
  },
  {
    label: 'HVAC & Refrigeration',
    skills: [
      'AC installation',
      'AC servicing',
      'Refrigerant handling',
      'Duct installation',
      'Cold room repair',
      'Heating systems',
      'Ventilation design',
      'Fault diagnosis',
      'Electrical controls',
      'Preventive maintenance',
    ],
  },
  {
    label: 'Photography & Videography',
    skills: [
      'Portrait photography',
      'Event photography',
      'Video editing',
      'Lighting setup',
      'Camera operation',
      'Drone photography',
      'Photo retouching',
      'Studio setup',
      'Audio recording',
      'Storyboard planning',
    ],
  },
  {
    label: 'Graphic Design',
    skills: [
      'Logo design',
      'Brand identity',
      'Adobe Photoshop',
      'Adobe Illustrator',
      'Layout design',
      'Print design',
      'Typography',
      'Social media graphics',
      'UI design',
      'Photo editing',
    ],
  },
  {
    label: 'Web & Software Development',
    skills: [
      'HTML & CSS',
      'JavaScript',
      'React',
      'Node.js',
      'Database design',
      'API development',
      'Responsive design',
      'Git version control',
      'Debugging',
      'Deployment',
    ],
  },
  {
    label: 'Culinary Arts & Catering',
    skills: [
      'Menu planning',
      'Food preparation',
      'Baking',
      'Grilling',
      'Food safety',
      'Kitchen hygiene',
      'Event catering',
      'Portion control',
      'Inventory management',
      'Customer service',
    ],
  },
  {
    label: 'Beauty & Cosmetology',
    skills: [
      'Hair styling',
      'Hair cutting',
      'Hair coloring',
      'Makeup',
      'Nail care',
      'Skincare',
      'Braiding',
      'Barbering',
      'Salon hygiene',
      'Client consultation',
    ],
  },
  {
    label: 'Tailoring & Fashion Design',
    skills: [
      'Garment tailoring',
      'Pattern making',
      'Sewing machine operation',
      'Fabric selection',
      'Alterations',
      'Dress design',
      'Embroidery',
      'Measurements',
      'Fitting',
      'Fashion sketching',
    ],
  },
  {
    label: 'Painting & Decorating',
    skills: [
      'Interior painting',
      'Exterior painting',
      'Wall preparation',
      'Spray painting',
      'Wallpaper installation',
      'Color mixing',
      'Decorative finishes',
      'Surface repair',
      'Safety practices',
      'Estimating paint',
    ],
  },
  {
    label: 'Landscaping & Gardening',
    skills: [
      'Plant care',
      'Garden design',
      'Lawn maintenance',
      'Tree pruning',
      'Irrigation systems',
      'Soil preparation',
      'Pest control',
      'Hedge trimming',
      'Landscaping materials',
      'Garden tools',
    ],
  },
  {
    label: 'Cleaning & Facility Services',
    skills: [
      'Deep cleaning',
      'Office cleaning',
      'Window cleaning',
      'Floor polishing',
      'Carpet cleaning',
      'Sanitation',
      'Waste management',
      'Equipment handling',
      'Chemical safety',
      'Team supervision',
    ],
  },
  {
    label: 'Business Administration',
    skills: [
      'Office administration',
      'Record keeping',
      'Scheduling',
      'Customer service',
      'Report writing',
      'Procurement',
      'Team coordination',
      'MS Office',
      'Time management',
      'Problem solving',
    ],
  },
  {
    label: 'Accounting & Finance',
    skills: [
      'Bookkeeping',
      'Financial reporting',
      'Payroll',
      'Tax preparation',
      'Budgeting',
      'Invoicing',
      'Reconciliation',
      'Excel',
      'Auditing',
      'Financial analysis',
    ],
  },
  {
    label: 'Education & Training',
    skills: [
      'Lesson planning',
      'Classroom management',
      'Student assessment',
      'Curriculum development',
      'Tutoring',
      'Communication',
      'Child safeguarding',
      'Educational technology',
      'Record keeping',
      'Mentoring',
    ],
  },
  {
    label: 'Health & Caregiving',
    skills: [
      'Patient care',
      'First aid',
      'Medication support',
      'Elderly care',
      'Child care',
      'Hygiene & infection control',
      'Vital signs monitoring',
      'Nutrition support',
      'Record keeping',
      'Empathy & communication',
    ],
  },
  {
    label: 'IT Support & Networking',
    skills: [
      'Computer repair',
      'Network setup',
      'Wi-Fi configuration',
      'Hardware troubleshooting',
      'Software installation',
      'Windows & Linux',
      'Printer support',
      'Data backup',
      'Cybersecurity basics',
      'Helpdesk support',
    ],
  },
  {
    label: 'Marketing & Communications',
    skills: [
      'Social media marketing',
      'Content writing',
      'Campaign planning',
      'Market research',
      'Customer engagement',
      'Brand promotion',
      'Analytics',
      'Public relations',
      'Copywriting',
      'Community management',
    ],
  },
  {
    label: 'Logistics & Transport',
    skills: [
      'Route planning',
      'Goods handling',
      'Inventory control',
      'Warehouse operations',
      'Delivery coordination',
      'Vehicle inspection',
      'Loading & unloading',
      'Documentation',
      'Time management',
      'Customer service',
    ],
  },
  {
    label: 'Customer Service & Sales',
    skills: [
      'Customer support',
      'Sales negotiation',
      'Complaint handling',
      'Product knowledge',
      'CRM tools',
      'Upselling',
      'Communication',
      'Conflict resolution',
      'Lead follow-up',
      'Record keeping',
    ],
  },
  {
    label: 'Agriculture & Farming',
    skills: [
      'Crop production',
      'Animal care',
      'Soil management',
      'Irrigation',
      'Pest management',
      'Harvesting',
      'Farm equipment',
      'Record keeping',
      'Agribusiness',
      'Sustainable farming',
    ],
  },
];

// Used for the "Other" degree path and for old free-text rows whose label is
// not in the catalogue, so those providers can still pick relevant skills.
export const GENERAL_SKILLS = [
  'Communication',
  'Customer service',
  'Time management',
  'Problem solving',
  'Teamwork',
  'Organization',
  'Record keeping',
  'Adaptability',
  'Attention to detail',
  'Negotiation',
];

export function skillsForDegree(degree: string | null | undefined): string[] {
  if (!degree) return [];
  if (degree === OTHER_DEGREE) return GENERAL_SKILLS;
  return DEGREE_PROGRAMS.find((program) => program.label === degree)?.skills ?? GENERAL_SKILLS;
}

export function isCatalogueDegree(degree: string | null | undefined): boolean {
  return !!degree && DEGREE_PROGRAMS.some((program) => program.label === degree);
}
