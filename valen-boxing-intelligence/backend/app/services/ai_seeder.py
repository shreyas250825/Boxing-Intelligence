"""
Seeds initial AI companion records and learning lessons into the database.
Called once at startup if the companion table is empty.
"""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.models.ai_corner import AICompanion, LearningLesson
from app.services.ai_companions import COMPANION_DEFINITIONS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Companion seeding
# ---------------------------------------------------------------------------

def seed_companions(db: Session) -> None:
    existing = db.query(AICompanion).count()
    if existing >= len(COMPANION_DEFINITIONS):
        return

    for i, defn in enumerate(COMPANION_DEFINITIONS):
        if db.query(AICompanion).filter(AICompanion.slug == defn["slug"]).first():
            continue
        companion = AICompanion(
            slug=defn["slug"],
            name=defn["name"],
            role=defn["role"],
            description=defn["description"],
            capabilities_json=json.dumps(defn.get("capabilities", [])),
            min_role=defn.get("min_role", "fighter"),
            icon=defn.get("icon"),
            color_accent=defn.get("color_accent"),
            is_active=True,
            display_order=i,
        )
        db.add(companion)

    try:
        db.commit()
        logger.info("AI companions seeded successfully")
    except Exception as exc:
        db.rollback()
        logger.error("Failed to seed AI companions: %s", exc)


# ---------------------------------------------------------------------------
# Learning lesson seeding
# ---------------------------------------------------------------------------

INITIAL_LESSONS = [
    {
        "slug": "boxing-stance-beginner",
        "title": "The Boxing Stance",
        "category": "Fundamentals",
        "difficulty": "beginner",
        "estimated_minutes": 5,
        "content": """# The Boxing Stance

Your stance is the foundation of everything in boxing. A correct stance gives you balance, power, and the ability to move and defend.

## Orthodox vs Southpaw
- **Orthodox** (right-handed): Left foot forward, right foot back. Right hand is your power hand.
- **Southpaw** (left-handed): Right foot forward, left foot back. Left hand is your power hand.

## Key Elements of a Correct Stance
1. **Feet**: Shoulder-width apart. Lead foot pointing slightly inward. Rear foot at 45 degrees.
2. **Knees**: Slightly bent — never locked.
3. **Weight distribution**: 60% on rear foot (ready to push off), 40% on lead foot.
4. **Hips**: Square but slightly turned.
5. **Guard**: Both hands up. Lead hand at eye level. Rear hand protecting the chin.
6. **Chin**: Tucked slightly down and protected by the lead shoulder.
7. **Elbows**: Close to the body to protect the ribs.

## Why Does This Matter?
A correct stance means you are always ready to attack or defend. A wide stance limits movement. A high stance exposes your body. A locked guard is slow to react.

## Common Mistakes
- Standing too square (exposes the body)
- Standing too narrow (poor balance)
- Dropping hands when tired
- Pointing chin upward

Practice drilling your stance in front of a mirror for 5 minutes before every session.
""",
        "quiz_json": json.dumps([
            {
                "question": "In an orthodox stance, which hand is the power hand?",
                "options": ["Left hand", "Right hand", "Both equally", "Depends on the fighter"],
                "correct_index": 1,
                "explanation": "In orthodox boxing, the right hand is the power hand (rear hand). The left hand is the lead jab hand.",
            },
            {
                "question": "Where should your weight distribution be in a boxing stance?",
                "options": [
                    "50% on each foot",
                    "60% on rear foot, 40% on lead foot",
                    "80% on lead foot",
                    "70% on rear foot, 30% on lead",
                ],
                "correct_index": 1,
                "explanation": "60% on the rear foot keeps you ready to push forward or backward quickly while maintaining balance.",
            },
            {
                "question": "Why should the chin be tucked down?",
                "options": [
                    "It looks more intimidating",
                    "It improves vision",
                    "It protects the chin from uppercuts and reduces knockout risk",
                    "It helps with breathing",
                ],
                "correct_index": 2,
                "explanation": "Tucking the chin reduces the exposed chin surface, making it harder to land clean shots that could cause a knockout.",
            },
        ]),
        "display_order": 1,
    },
    {
        "slug": "jab-fundamentals-beginner",
        "title": "The Jab",
        "category": "Punching Technique",
        "difficulty": "beginner",
        "estimated_minutes": 7,
        "content": """# The Jab

The jab is the most important punch in boxing. It sets up all other combinations, controls distance, and gathers information about the opponent.

## Mechanics of the Jab
1. Start from your guard position
2. Rotate the lead shoulder forward
3. Extend the lead arm straight toward the target
4. Rotate the fist so knuckles face upward at full extension
5. Return immediately to guard

## What Makes a Good Jab?
- **Speed**: The jab should be your fastest punch
- **Recovery**: Return to guard as fast as you threw it
- **Angles**: Mix up high, body and step-in jabs
- **Don't telegraph**: Don't drop the hand before throwing

## Types of Jabs
- **Range-finder jab**: Light, probing, gathering information
- **Power jab**: Full weight behind it — used to hurt
- **Step jab**: Step forward as you throw for extra reach
- **Body jab**: Aim at the solar plexus to break the guard

## Using the Jab Tactically
- Set up the cross: jab → cross is the foundation of boxing
- Control distance: keep opponents at jab range
- Interrupt opponent's rhythm
- Distract to set up hooks

## Common Mistakes
- Dropping the rear hand when jabbing
- Overextending and losing balance
- Throwing from too far away (telegraphed)
- Keeping the arm out instead of returning quickly
""",
        "quiz_json": json.dumps([
            {
                "question": "What is the primary purpose of the jab?",
                "options": [
                    "To knock out the opponent",
                    "To control distance, set up combinations, and gather information",
                    "To score maximum points",
                    "To tire the opponent with volume",
                ],
                "correct_index": 1,
                "explanation": "The jab is a versatile tool — its main role is controlling distance and creating opportunities for power punches.",
            },
            {
                "question": "Which is the most common mistake when throwing a jab?",
                "options": [
                    "Throwing too fast",
                    "Dropping the rear hand when jabbing",
                    "Using the wrong foot",
                    "Stepping too far",
                ],
                "correct_index": 1,
                "explanation": "Dropping the rear hand exposes your head to counter-punches. The rear hand must stay up at all times.",
            },
        ]),
        "display_order": 2,
    },
    {
        "slug": "boxing-scoring-rules",
        "title": "How Boxing is Scored",
        "category": "Rules & Scoring",
        "difficulty": "beginner",
        "estimated_minutes": 6,
        "content": """# How Boxing is Scored

Understanding how boxing is scored helps you understand what wins fights — both in training reviews and in competition.

## The 10-Point Must System
Each round is scored on a 10-point scale:
- **Winner of the round**: 10 points
- **Loser of the round**: 9 points (or 8 if knocked down or clearly dominated)

## What Judges Look For
In professional boxing, judges typically score on four criteria:

1. **Clean punching**: Hard, accurate punches that land flush
2. **Effective aggression**: Pressing forward with purpose (not just walking in)
3. **Defence**: Avoiding punches cleanly (slipping, rolling, blocking)
4. **Ring generalship**: Controlling the pace, distance, and positioning

## What Counts as a Clean Punch?
- The punch must land with the knuckle part of the closed fist
- It must land on the permitted target area (above the belt, excluding the back of the head)
- It must land with force — grazing shots do not typically score

## Knockdowns
- Any knockdown adds an automatic point deduction for that round
- Even if a fighter recovers and wins the round's exchanges, the knockdown typically means they lose the round

## Amateur Boxing vs Professional Boxing
- **Amateur (AIBA)**: Points scored electronically for each valid clean punch
- **Professional**: Ten-point must system over 4–12 rounds, judges' decisions

## Common Scoring Misconceptions
- Aggression alone doesn't win rounds — it must be *effective* aggression
- Running or clinching too much can cost points in aggression scoring
- Defence is scored — a boxer who avoids all punches is still performing
""",
        "quiz_json": json.dumps([
            {
                "question": "Under the 10-point must system, what does the round winner receive?",
                "options": ["10 points", "5 points", "Depends on the margin", "1 point"],
                "correct_index": 0,
                "explanation": "The winner of any round always receives 10 points under the 10-point must system. The loser receives 9 (or 8 if knocked down).",
            },
            {
                "question": "Which of the following is typically NOT one of the four scoring criteria?",
                "options": [
                    "Clean punching",
                    "Effective aggression",
                    "Number of rounds boxed",
                    "Ring generalship",
                ],
                "correct_index": 2,
                "explanation": "The number of rounds boxed is not a scoring criterion. The four standard criteria are clean punching, effective aggression, defence, and ring generalship.",
            },
        ]),
        "display_order": 5,
    },
    {
        "slug": "defensive-basics",
        "title": "Boxing Defence Fundamentals",
        "category": "Defence",
        "difficulty": "beginner",
        "estimated_minutes": 8,
        "content": """# Boxing Defence Fundamentals

Defence is often described as the most important skill in boxing. A boxer who cannot be hit accurately is very difficult to beat.

## Core Defensive Techniques

### 1. Slipping
Move your head off the centre line to avoid a straight punch.
- Slip outside the jab: move head to your left (orthodox) as the opponent jabs
- Slip inside the jab: move head to your right
- Keep your eyes on the opponent throughout the slip

### 2. Rolling (Bob and Weave)
Drop your body level and move through a hook or swing.
- Bend the knees to drop the level
- Move in a U-shape under the punch
- Come up on the other side ready to counter

### 3. Parrying
Use your hand to redirect an incoming punch.
- Parry a jab with your rear hand (tap it to the outside)
- Parry a cross with your lead hand
- Keep the parry small — don't chase the punch

### 4. The Guard
Your first line of defence.
- High guard: both gloves near temples, elbows protecting ribs
- Peek-a-boo: hands near cheeks, very close guard
- Philly shell: rear hand near chin, lead shoulder raised

### 5. Footwork as Defence
Moving away from danger is often the safest defence.
- Step back from a cross
- Step to the side to avoid combinations
- Circle away from the opponent's power hand

## Defence Creates Offence
Every defensive movement creates an opportunity:
- Slip + left hook
- Roll under hook + right cross to the body
- Parry jab + right cross

Practice defensive techniques in combination with counter-punches from the start.
""",
        "quiz_json": json.dumps([
            {
                "question": "What is 'slipping' in boxing?",
                "options": [
                    "Losing balance on the canvas",
                    "Moving the head off the centre line to avoid a straight punch",
                    "Ducking under a hook",
                    "Using the glove to redirect a punch",
                ],
                "correct_index": 1,
                "explanation": "Slipping means moving the head to one side to take it off the path of a straight punch, without blocking it.",
            },
            {
                "question": "What is the key principle when parrying?",
                "options": [
                    "Swing your arm wide to deflect",
                    "Keep the parry small — don't chase the punch",
                    "Use both hands simultaneously",
                    "Always parry with the same side",
                ],
                "correct_index": 1,
                "explanation": "Small, precise parries are efficient. Large parrying movements leave you open to follow-up punches and take too long to reset.",
            },
        ]),
        "display_order": 6,
    },
    {
        "slug": "footwork-fundamentals",
        "title": "Footwork and Movement",
        "category": "Footwork",
        "difficulty": "beginner",
        "estimated_minutes": 7,
        "content": """# Footwork and Movement

Footwork is what separates good boxers from great ones. It controls distance, creates angles, and is the foundation of both attack and defence.

## The Basics of Footwork

### Stepping, Not Crossing
The most important rule: **never cross your feet**. When you move, step with the foot in the direction of movement first, then bring the other foot to restore your stance.

- Move right: right foot first, then left foot
- Move left: left foot first, then right foot
- Move forward: lead foot first, then rear foot
- Move back: rear foot first, then lead foot

### Maintaining Stance Width
Your feet should remain approximately shoulder-width apart during movement. Crossing feet or getting too narrow destroys your balance and power base.

## Key Movement Patterns

### Lateral Movement
Moving side to side creates new angles and moves you out of the line of attack.
- Circle to your left (orthodox): move away from opponent's power hand
- Circle to your right: move toward opponent's weak hand

### Pivoting
Pivot on the lead foot to create angles without moving backward.
- Plant lead foot, push off rear foot and pivot 45–90 degrees
- Creates new punching angles instantly

### In-and-Out Movement
Control the engagement distance:
- Step in with the lead foot to get into punching range
- Push off the rear foot to exit quickly after punching

## Footwork Drills
1. **Box drill**: Move in a square pattern (forward, right, back, left)
2. **Ladder drill**: Quick feet through a rope ladder
3. **Mirror drill**: Copy a partner's movement for 2 minutes
4. **Pivot drill**: Throw a jab and pivot 90 degrees, repeat

## Common Mistakes
- Flat feet (heel on floor, limits speed)
- Crossing feet
- Looking down
- Taking too large a step
""",
        "quiz_json": json.dumps([
            {
                "question": "When moving to the right in an orthodox stance, which foot moves first?",
                "options": ["Left foot", "Right foot", "Both simultaneously", "Either is fine"],
                "correct_index": 1,
                "explanation": "Always step with the foot in the direction of movement first — this prevents crossing your feet and maintains balance.",
            },
            {
                "question": "Why is circling to your left generally preferred for an orthodox boxer?",
                "options": [
                    "It's easier to execute",
                    "It moves you away from the opponent's power hand",
                    "It creates more space to throw hooks",
                    "It's the direction most coaches prefer",
                ],
                "correct_index": 1,
                "explanation": "Circling left (for orthodox) moves you away from the opponent's right hand (their power hand), reducing your exposure to their strongest punch.",
            },
        ]),
        "display_order": 7,
    },
    {
        "slug": "combinations-intro",
        "title": "Introduction to Combinations",
        "category": "Combinations",
        "difficulty": "beginner",
        "estimated_minutes": 8,
        "content": """# Introduction to Combinations

Single punches in boxing are easy to see coming and easy to avoid. Combinations are sequences of punches that create openings and accumulate scoring damage.

## Why Combinations?
- Keep the opponent thinking about multiple threats
- One punch creates an opening for the next
- Accumulate damage across multiple targets (head + body)
- Higher scoring output in competition

## Basic Punch Numbering System
Most boxing gyms use a standard numbering system:
- **1** = Jab
- **2** = Cross
- **3** = Lead hook
- **4** = Rear hook
- **5** = Lead uppercut
- **6** = Rear uppercut

## The Foundation Combinations

### 1-2 (Jab-Cross)
The most fundamental combination in boxing.
1. Throw the jab to close distance and distract
2. Follow immediately with the cross behind it
3. Return to guard

### 1-2-3 (Jab-Cross-Hook)
Add the lead hook after the cross.
1. Jab (establishes range)
2. Cross (power punch, opens guard)
3. Lead hook (comes from the side while guard is occupied)

### 1-1-2 (Double Jab-Cross)
Use two jabs before the cross.
1. First jab: range-finder, probe the guard
2. Second jab: break through the guard
3. Cross: power punch through the gap created

### 1-2-3-2 (Jab-Cross-Hook-Cross)
A full four-punch combination.
- Flows from 1-2-3, ending with a second cross as the opponent covers the hook

## Principles of Combinations
1. **Return to guard** between every punch
2. **Move your head** after combinations (don't stand in front of counter-punches)
3. **Body-head**: Hit the body to bring the guard down, then go upstairs
4. **Head-body**: Hit the head to raise the guard, then attack the body

## Training Combinations
- Shadow box each combination slowly, then build speed
- Practise on the heavy bag to develop power
- Use pads with a partner for realistic timing
- Sparring develops the ability to throw combinations in real exchanges
""",
        "quiz_json": json.dumps([
            {
                "question": "In the standard boxing numbering system, what is punch number 3?",
                "options": ["Cross", "Lead hook", "Rear hook", "Lead uppercut"],
                "correct_index": 1,
                "explanation": "The lead hook is punch 3. The sequence is: 1=jab, 2=cross, 3=lead hook, 4=rear hook, 5=lead uppercut, 6=rear uppercut.",
            },
            {
                "question": "What should you do immediately after finishing a combination?",
                "options": [
                    "Rest and observe",
                    "Throw another combination immediately",
                    "Return to guard and move your head",
                    "Step back to maximum distance",
                ],
                "correct_index": 2,
                "explanation": "After every combination, return to your guard immediately and move your head. Standing still after punching invites counter-attacks.",
            },
        ]),
        "display_order": 8,
    },
    {
        "slug": "ring-generalship",
        "title": "Ring Generalship",
        "category": "Tactics",
        "difficulty": "intermediate",
        "estimated_minutes": 9,
        "content": """# Ring Generalship

Ring generalship is the ability to control where and how a fight unfolds. It's one of the four criteria judges score, and it often determines close fights.

## What is Ring Generalship?
Ring generalship means:
- Controlling the centre of the ring
- Dictating the distance of the fight
- Setting the pace and tempo
- Creating angles and traps

## The Centre of the Ring
Controlling the centre gives you more space to move in any direction. A fighter pushed to the ropes or corners has fewer options. Controlling the centre does not mean standing still — it means returning to the centre after exchanges.

## Distance Management
Every boxer has an optimal fighting range:
- **Outside range**: Where only the jab reaches. Safer but less power.
- **Mid-range**: Where crosses and hooks land. Most exchanges happen here.
- **Inside range**: Where uppercuts and short hooks are effective.

Managing distance means choosing your range strategically and preventing the opponent from imposing theirs.

## Pace and Tempo
- A fast-starter opponent may tire in later rounds — slow down the first rounds
- A slow-starter may save energy — use early rounds to build a lead
- Changing pace (bursts of activity followed by controlled periods) disrupts the opponent

## Angles
Positioning at angles forces the opponent to turn, disrupting their stance:
- After a combination, pivot or step to the side
- An angle of even 45 degrees changes which punches are available
- Pressure fighters struggle with constant angle changes

## Trapping the Opponent
Deliberately back the opponent toward the ropes or corner:
- Use lateral movement to cut off the ring
- Use jabs and feints to direct movement
- Once pinned, attack with combinations

## Application in Competition
A boxer with superior ring generalship often controls the narrative of the fight, determines when exchanges happen, and lands punches at better angles than their opponent.
""",
        "quiz_json": json.dumps([
            {
                "question": "Why is controlling the centre of the ring important?",
                "options": [
                    "The centre is easier to defend",
                    "It gives more movement options and forces the opponent to the ropes",
                    "Judges always favour the centre fighter",
                    "It reduces the distance to the opponent",
                ],
                "correct_index": 1,
                "explanation": "From the centre, you can move in any direction. An opponent at the ropes has fewer escape routes and less room to avoid combinations.",
            },
            {
                "question": "What is the most effective way to disrupt a pressure fighter?",
                "options": [
                    "Standing still and countering",
                    "Fighting at close range",
                    "Constant angle changes using footwork",
                    "Using a high guard and waiting",
                ],
                "correct_index": 2,
                "explanation": "Constant angle changes make it difficult for a pressure fighter to cut off the ring. They must keep resetting their approach after each angle change.",
            },
        ]),
        "display_order": 15,
    },
]


def seed_lessons(db: Session) -> None:
    existing = db.query(LearningLesson).count()
    if existing >= len(INITIAL_LESSONS):
        return

    for lesson_data in INITIAL_LESSONS:
        if db.query(LearningLesson).filter(LearningLesson.slug == lesson_data["slug"]).first():
            continue
        lesson = LearningLesson(
            slug=lesson_data["slug"],
            title=lesson_data["title"],
            category=lesson_data["category"],
            difficulty=lesson_data["difficulty"],
            content=lesson_data["content"],
            quiz_json=lesson_data.get("quiz_json"),
            estimated_minutes=lesson_data["estimated_minutes"],
            display_order=lesson_data["display_order"],
            is_published=True,
        )
        db.add(lesson)

    try:
        db.commit()
        logger.info("Learning lessons seeded successfully")
    except Exception as exc:
        db.rollback()
        logger.error("Failed to seed learning lessons: %s", exc)


def seed_all(db: Session) -> None:
    seed_companions(db)
    seed_lessons(db)
