import { InternalServerErrorException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ProductsService } from './../products/products.service';
import { initialData } from './data/seed-data';
import { User } from '../auth/entities/user.entity';


@Injectable()
export class SeedService {

  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,

    @InjectRepository( User )
    private readonly userRepository: Repository<User>
  ) {}


  async runSeed() {

    const adminCredentials = this.getAdminCredentials();
    await this.deleteTables();
    const adminUser = await this.insertAdminUser(adminCredentials);

    await this.insertNewProducts( adminUser );

    return 'SEED EXECUTED';
  }

  private async deleteTables() {

    await this.productsService.deleteAllProducts();

    const queryBuilder = this.userRepository.createQueryBuilder();
    await queryBuilder
      .delete()
      .where('1 = 1')
      .execute()

  }

  private getAdminCredentials(): { email: string; password: string } {
    const email = this.configService.get<string>('SEED_ADMIN_EMAIL')?.trim();
    const password = this.configService.get<string>('SEED_ADMIN_PASSWORD');

    if (!email || !password || password.length < 6) {
      throw new InternalServerErrorException(
        'Configure SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 6 characters before running the seed.',
      );
    }

    return { email, password };
  }

  private async insertAdminUser(credentials: {
    email: string;
    password: string;
  }): Promise<User> {
    const admin = this.userRepository.create({
      email: credentials.email,
      fullName: 'Seed Administrator',
      password: await bcrypt.hash(credentials.password, 10),
      roles: ['admin'],
    });

    return this.userRepository.save(admin);
  }


  private async insertNewProducts( user: User ) {
    await this.productsService.deleteAllProducts();

    const products = initialData.products;

    const insertPromises = [];

    products.forEach( product => {
      insertPromises.push( this.productsService.create( product, user ) );
    });

    await Promise.all( insertPromises );


    return true;
  }


}
