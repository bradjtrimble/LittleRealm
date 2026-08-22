# Little Realm Audio

Little Realm audio is project content. The engine provides playback, mixing, positional attenuation, looping, and event hooks; the World Builder decides which clips and Sound Sets are used. No specific creature, terrain, object, or zone owns a hard-coded filename.

## Importing audio

Open **World Builder → Audio**. Choose a category and select one or many `.mp3`, `.ogg`, or `.wav` files. The Builder copies them into the connected project folder under `assets/audio/` and registers ordinary Audio Clip records in `content/shared/content-library.json`.

Categories are **Music**, **Ambience**, **Sound Effects**, and **UI**. Categories organize the library and route clips through the appropriate mixer bus; they do not make individual clips special.

Audio is loaded on demand. Large music/ambience libraries are not part of the PWA install precache.

## Sound Sets

A Sound Set is a reusable group of Audio Clips. Playback randomly selects a member, which is useful for footsteps, attack variations, impacts, creature vocalizations, and other sounds that would become repetitive if a single clip played every time.

Create and edit Sound Sets in the **Audio** tab. Other editors can reference either a clip or, where offered, a Sound Set.

## Terrain footsteps

Every Terrain Library record can choose a **Footstep Sound Set** and Footstep Volume. As the player moves, the runtime reads the terrain under the player and triggers randomized clips from that set.

Typical examples:

- Grass → soft grass steps
- Snow → crunch variations
- Stone/Cobble → hard shoe clicks
- Mud → wet squelches
- Shallow water → splash variations
- Wood floor → hollow wooden steps

Leaving the set blank makes the terrain silent. Footstep behavior belongs to the terrain record, so newly imported terrain works exactly like original terrain.

## Zone music and ambience

Each zone can choose optional **Music** and **Ambience** clips plus independent volume levels. Entering/switching zones updates these layers with a short transition instead of requiring code changes.

Music and ambience are non-positional mix layers.

## Mob audio

Mob Types can assign audio to:

- Aggro
- Attack
- Hit / Hurt
- Death

They can also define an audible range. World mob sounds use positional attenuation/panning, so distant enemies are quieter and slightly biased toward their screen/world direction.

## Interactions and sound emitters

World-object interactions can assign an **Interaction Sound** such as a chest opening, door movement, harvest action, lever, or portal activation.

Placed objects can also become looping **Sound Emitters** with a clip, volume, and audible range. Use emitters for localized environmental sound such as waterfalls, fireplaces, fountains, buzzing hives, machines, or magical portals.

## Global gameplay events

The Audio tab provides project-level assignments for common engine events such as player attack/hit, potion use, loot pickup, quest acceptance/completion, and level-up. The engine knows the event; project content chooses the sound.

## Player mixer settings

The game menu contains local volume controls for:

- Master
- Music
- Ambience
- Sound Effects
- UI
- Mute All

These are player preferences stored locally and are not part of project/world content.

## Browser autoplay

Browsers require a user gesture before Web Audio can start. Little Realm unlocks audio on the first pointer or keyboard interaction. A page can therefore appear silently until the player first clicks/taps/presses a key; this is expected browser behavior.

## Project Health

Project Health checks audio references and imported files, including missing clips, missing Sound Sets, invalid set members, broken terrain/mob/interaction/zone references, unsupported audio extensions, and unusually large imported audio files. Optional blank audio fields are valid.
