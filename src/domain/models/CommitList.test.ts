import { expect } from 'chai';
import { Domain } from '@gitorial/shared-types';
import { CommitList } from './CommitList';
import { c } from '@gitorial/test-utils';
import { Commit } from './Commit';

describe('Domain CommitList', () => {
  const validSequence: Commit[] = [
    Commit.newFromObject(c('section', 'Introduction', ['README.md'])),
    Commit.newFromObject(c('action', 'Cargo Init')),
    Commit.newFromObject(c('action', 'rustfmt config + fmt')),
    Commit.newFromObject(c('section', 'balances pallet', ['README.md'])),
    Commit.newFromObject(
      c(
        'template',
        'introduce balances module',
        ['pallets/balances/src/lib.rs'],
        [{ realtiveFilePath: 'pallets/balances/src/lib.rs' }]
      )
    ),
    Commit.newFromObject(c('solution', 'introduce balances module', ['pallets/balances/src/lib.rs'], [])),
    Commit.newFromObject(c('readme', 'Repo End')),
  ];

  const invalidSequence: Commit[] = [
    Commit.newFromObject(c('section', 'Introduction', ['README.md'])),
    Commit.newFromObject(c('solution', 'Cargo Init')),
  ];

  const mixedInvalid: Commit[] = [
    Commit.newFromObject(c('section', 'Intro', ['README.md', 'src/a.ts'])),
    Commit.newFromObject(c('solution', 'Missing predecessor')),
    Commit.newFromObject(c('readme', 'Mid')),
    Commit.newFromObject(c('template', 'X')),
  ];

  it('creates from a valid sequence', () => {
    const created = CommitList.new(validSequence, Domain.CommitList.V1.Rules);
    expect(created.isOk()).to.equal(true);
    const list = created._unsafeUnwrap();
    expect(list.length).to.equal(validSequence.length);
    expect(list.toArray()).to.deep.equal(validSequence);
  });

  it('fails to create from an invalid sequence', () => {
    const created = CommitList.new(invalidSequence, Domain.CommitList.V1.Rules);
    expect(created.isErr()).to.equal(true);
  });

  it('fails for a mixed invalid sequence', () => {
    const created = CommitList.new(mixedInvalid, Domain.CommitList.V1.Rules);
    expect(created.isErr()).to.equal(true);
  });
});
