import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import {
  RecentlyAxiesSold,
  RecentlyAxiesSoldDocument,
} from '../schemas/recently-axies-sold.schema';
import { Model } from 'mongoose';
import { AxieGene } from 'agp-npm/dist/axie-gene';
import { Axie, AxieDocument } from '../schemas/axie.schema';
import { GetLatestAxiesQueryDto } from '../dtos/get-latest-axies-query.dto';
import {
  LatestAxies,
  LatestAxiesDocument,
} from '../schemas/latest-axies.schema';

@Injectable()
export class AxiesService {
  constructor(
    @InjectModel(LatestAxies.name)
    private latestAxiesModel: Model<LatestAxiesDocument>,
    @InjectModel(RecentlyAxiesSold.name)
    private recentlyAxiesSoldModel: Model<RecentlyAxiesSoldDocument>,
    @InjectModel(Axie.name)
    private axieModel: Model<AxieDocument>,
    private httpService: HttpService,
  ) {}

  findOne(id: string): Promise<AxieDocument> {
    return new Promise((resolve, reject) => {
      this.getAxieDetail(id).then(resolve).catch(reject);
    });
  }

  async listLatest() {
    return await this.latestAxiesModel.find().exec();
  }

  async listAxies() {
    return await this.axieModel.find().exec();
  }

  async listRecentlySold() {
    return await this.recentlyAxiesSoldModel.find().exec();
  }

  async getAxieLatest(input: GetLatestAxiesQueryDto) {
    try {
      const { from, size, sort, auctionType, criteria } = input;
      const query = `query GetAxieLatest($auctionType: AuctionType, $criteria: AxieSearchCriteria, $from: Int, $sort: SortBy, $size: Int, $owner: String) {
  axies(auctionType: $auctionType, criteria: $criteria, from: $from, sort: $sort, size: $size, owner: $owner) {
    total
    results {
      id
      image
      class
      name
      genes
      owner
      class
      stage
      title
      breedCount
      level
      parts {
        id
        name
        class
        type
        specialGenes
        stage
        abilities {
          id
          name
          attack
          defense
          energy
          description
          backgroundUrl
          effectIconUrl
          __typename
        }
        __typename
      }
      stats {
        hp
        speed
        skill
        morale
        __typename
      }
      auction {
        startingPrice
        endingPrice
        startingTimestamp
        endingTimestamp
        duration
        timeLeft
        currentPrice
        currentPriceUSD
        suggestedPrice
        seller
        listingIndex
        state
        __typename
      }
      __typename
      __typename
    }
    __typename
  }
}
`;
      const result = await this.httpService
        .post(
          'https://axieinfinity.com/graphql-server-v2/graphql',
          JSON.stringify({
            query,
            variables: {
              from,
              size,
              sort,
              auctionType,
              criteria,
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        .toPromise();
      const { data } = result.data;
      const list = data.axies.results;
      await this.latestAxiesModel.deleteMany({});
      for (const axie of list) {
        const {
          id,
          image,
          class: cls,
          name,
          genes,
          owner,
          stage,
          title,
          breedCount,
          level,
          parts,
          stats,
          auction,
        } = axie;
        const createdAxie = new this.latestAxiesModel({
          id,
          image,
          class: cls,
          name,
          genes,
          owner,
          stage,
          title,
          breedCount,
          level,
          parts,
          stats,
          auction,
        });
        await createdAxie.save();
      }
    } catch (error) {
      console.log(error);
    }
  }

  async getAxieDetail(axieId: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const query = `query GetAxieDetail($axieId: ID!) {
  axie(axieId: $axieId) {
    id
    image
    class
    chain
    name
    genes
    owner
    birthDate
    bodyShape
    sireId
    sireClass
    matronId
    matronClass
    stage
    title
    breedCount
    level
    figure {
      atlas
      model
      image
      __typename
    }
    stats {
      hp
      speed
      skill
      morale
      __typename
    }
    auction {
      startingPrice
      endingPrice
      startingTimestamp
      endingTimestamp
      duration
      timeLeft
      currentPrice
      currentPriceUSD
      suggestedPrice
      seller
      listingIndex
      state
      __typename
    }
    ownerProfile {
      name
      __typename
    }
    battleInfo {
      banned
      banUntil
      level
      __typename
    }
    children {
      id
      name
      class
      image
      title
      stage
      __typename
    }
    parts {
      id
      name
      class
      type
      specialGenes
      stage
      abilities {
        id
        name
        attack
        defense
        energy
        description
        backgroundUrl
        effectIconUrl
        __typename
      }
      __typename
      __typename
    }
    __typename
  }
}
`;

        const result = await this.httpService
          .post(
            'https://axieinfinity.com/graphql-server-v2/graphql',
            JSON.stringify({
              query,
              variables: { axieId },
            }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .toPromise();
        const { data } = result.data;
        const { axie } = data;
        const { genes, stats, parts, class: cls } = axie;
        const axieGene = new AxieGene(genes);
        const genQuantity = axieGene.getGeneQuality();
        const allGenes = axieGene.genes;
        const createdAxie = new this.axieModel({
          class: cls,
          stats,
          parts,
          allGenes,
          genQuantity,
        });
        resolve(createdAxie);
        // await createdAxie.save();
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  async getRecentlyAxiesSold(from: number, size: number) {
    try {
      const query = `query GetRecentlyAxiesSold($from: Int, $size: Int) {
  settledAuctions {
    axies(from: $from, size: $size) {
      total
      results {
        id
        name
        image
        class
        breedCount
        transferHistory {
          total
          results {
            timestamp
            withPrice
            withPriceUsd
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
      `;

      const result = await this.httpService
        .post(
          'https://axieinfinity.com/graphql-server-v2/graphql',
          JSON.stringify({
            query,
            variables: { from, size },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        .toPromise();

      const { data } = result.data;

      const axies = data.settledAuctions.axies.results;
      await this.recentlyAxiesSoldModel.deleteMany({});
      for (const axie of axies) {
        const {
          id,
          name,
          class: cls,
          image,
          breedCount,
          transferHistory,
        } = axie;
        const th = transferHistory.results[0];
        const { timestamp, withPrice, withPriceUsd } = th;
        const createdAxie = new this.recentlyAxiesSoldModel({
          id,
          name,
          class: cls,
          image,
          breedCount,
          timestamp,
          withPrice,
          withPriceUsd,
        });
        await createdAxie.save();
      }
    } catch (error) {
      console.log(error);
    }
  }
}
